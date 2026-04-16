import { Injectable, inject } from '@angular/core';
import { supabase } from './supabase.service';
import { ContribuyenteService } from './contribuyente.service';
import { environment } from '../../../environments/environment';
import { Contribuyente } from '../types/database.types';
import {
  ClienteFacturaData,
  getClienteDocData,
  getCondicionIvaReceptorId,
  getNotaCreditoTipo,
  normalizeCondicionIva,
  resolveTipoComprobante,
  sanitizeCuit,
} from '../utils/factura-cliente.util';

export interface FacturaRequestData {
  monto: number;
  fecha: string; // DD/MM/YYYY
  cliente_cuit?: string | null;
  cliente_nombre?: string | null;
  cliente_domicilio?: string | null;
  cliente_condicion_iva?: string | null;
  tipo_comprobante_resuelto?: 'FACTURA A' | 'FACTURA B' | 'FACTURA C';
}

export interface ArcaProxyResponse {
  success: boolean;
  data?: {
    CAE: string;
    CAEFchVto: string;
    CbteDesde: number;
    CbteTipo: number;
    PtoVta: number;
    Resultado: string;
  };
  error?: string;
}

export interface FacturaResult {
  success: boolean;
  comprobante?: any;
  error?: string;
}

export interface NotaCreditoResult {
  success: boolean;
  data?: {
    numero: string;
    cae?: string;
    vencimiento_cae?: string;
    pdf_url?: string;
    comprobante: any;
  };
  error?: string;
  shouldRetry?: boolean;
}

export interface ClienteLookupResult extends ClienteFacturaData {
  condicion_iva_normalizada: string;
}

@Injectable({
  providedIn: 'root',
})
export class FacturacionService {
  private readonly supabaseUrl = environment.supabase.url;
  private readonly contribuyenteService = inject(ContribuyenteService);

  private isValidInvoiceDate(
    fecha: Date,
    actividad: 'bienes' | 'servicios'
  ): { isValid: boolean; error?: string } {
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      return { isValid: false, error: 'No se pueden emitir facturas con fecha futura' };
    }

    const maxDays = actividad === 'bienes' ? 5 : 10;
    if (daysDiff > maxDays) {
      return {
        isValid: false,
        error: `Para ${actividad} solo se permiten facturas hasta ${maxDays} dias atras segun normativa ARCA`,
      };
    }

    return { isValid: true };
  }

  private getValidatedConfig(): Contribuyente {
    const contribuyente = this.contribuyenteService.contribuyente();

    if (!contribuyente) {
      throw new Error('No hay contribuyente configurado. Ve a Configuracion para completar tus datos.');
    }

    if (!contribuyente.cuit || !contribuyente.razon_social) {
      throw new Error('Configuracion incompleta. Completa al menos CUIT y razon social en Configuracion.');
    }

    return contribuyente;
  }

  private getConceptoAfip(actividad: 'bienes' | 'servicios'): number {
    return actividad === 'bienes' ? 1 : 2;
  }

  private getFechaLocalISO(): string {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private fechaDDMMYYYYtoISO(fecha: string): string {
    const [dia, mes, anio] = fecha.split('/');
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  private formatNumeroComprobante(ptoVta: number, cbteNro: number): string {
    return `${String(ptoVta).padStart(4, '0')}-${String(cbteNro).padStart(8, '0')}`;
  }

  private async getFreshAccessToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No hay sesion activa');
    }

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
    const shouldRefresh = expiresAtMs !== null && expiresAtMs - Date.now() < 60_000;

    if (shouldRefresh) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        throw new Error('No se pudo refrescar la sesion');
      }

      const refreshedToken = data.session?.access_token;
      if (refreshedToken) {
        return refreshedToken;
      }
    }

    if (!session.access_token) {
      throw new Error('No se pudo obtener un token de sesion valido');
    }

    return session.access_token;
  }

  async emitirFactura(facturaData: FacturaRequestData): Promise<FacturaResult> {
    const contribuyente = this.getValidatedConfig();
    const cliente = this.buildClienteFacturaData(facturaData);
    const tipoComprobante =
      facturaData.tipo_comprobante_resuelto ||
      resolveTipoComprobante(
        contribuyente.condicion_iva,
        cliente.cliente_condicion_iva,
        contribuyente.tipo_comprobante_default || 'FACTURA C'
      );

    const actividad = contribuyente.actividad === 'bienes' ? 'bienes' : 'servicios';
    const [dia, mes, anio] = facturaData.fecha.split('/');
    const fecha = new Date(parseInt(anio, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
    const fechaValidation = this.isValidInvoiceDate(fecha, actividad);

    if (!fechaValidation.isValid) {
      throw new Error(fechaValidation.error);
    }

    const resultado = await this.llamarArca(contribuyente, facturaData, cliente, tipoComprobante);

    if (!resultado.success || !resultado.data) {
      throw new Error(resultado.error || 'Error al emitir factura');
    }

    const numeroComprobante = this.formatNumeroComprobante(
      resultado.data.PtoVta,
      resultado.data.CbteDesde
    );

    const { data: comprobante, error: insertError } = await supabase
      .from('comprobantes')
      .insert({
        contribuyente_id: contribuyente.id,
        tipo_comprobante: tipoComprobante,
        numero_comprobante: numeroComprobante,
        punto_venta: contribuyente.punto_venta,
        fecha: this.fechaDDMMYYYYtoISO(facturaData.fecha),
        total: facturaData.monto,
        cae: resultado.data.CAE,
        vencimiento_cae: resultado.data.CAEFchVto,
        estado: 'emitida',
        concepto: contribuyente.concepto,
        pdf_url: null,
        cliente_cuit: cliente.cliente_cuit,
        cliente_doc_tipo: cliente.cliente_doc_tipo,
        cliente_doc_nro: cliente.cliente_doc_nro,
        cliente_nombre: cliente.cliente_nombre,
        cliente_domicilio: cliente.cliente_domicilio,
        cliente_condicion_iva: cliente.cliente_condicion_iva,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error('No se pudo guardar el comprobante en la base de datos');
    }

    return {
      success: true,
      comprobante: {
        ...comprobante,
        cae: resultado.data.CAE,
        vencimiento_cae: resultado.data.CAEFchVto,
      },
    };
  }

  private async llamarArca(
    contribuyente: Contribuyente,
    facturaData: FacturaRequestData,
    cliente: {
      cliente_cuit: string | null;
      cliente_doc_tipo: number;
      cliente_doc_nro: number;
      cliente_nombre: string | null;
      cliente_domicilio: string | null;
      cliente_condicion_iva: string;
    },
    tipoComprobante: 'FACTURA A' | 'FACTURA B' | 'FACTURA C'
  ): Promise<{ success: boolean; data?: ArcaProxyResponse['data']; error?: string }> {
    try {
      const accessToken = await this.getFreshAccessToken();
      const actividad = contribuyente.actividad === 'bienes' ? 'bienes' : 'servicios';

      const requestBody = {
        punto_venta: contribuyente.punto_venta,
        tipo_comprobante: tipoComprobante,
        monto: facturaData.monto,
        fecha: this.fechaDDMMYYYYtoISO(facturaData.fecha),
        concepto_afip: this.getConceptoAfip(actividad),
        iva_porcentaje: contribuyente.iva_porcentaje,
        doc_tipo: cliente.cliente_doc_tipo,
        doc_nro: cliente.cliente_doc_nro,
        condicion_iva_receptor_id: getCondicionIvaReceptorId(cliente.cliente_condicion_iva),
      };

      const response = await fetch(`${this.supabaseUrl}/functions/v1/arca-proxy?action=crear-factura`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: environment.supabase.anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseData: ArcaProxyResponse = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.error || 'Error al emitir factura');
      }

      return {
        success: true,
        data: responseData.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  async crearNotaCredito(
    comprobanteId: string,
    numeroComprobante: string,
    monto: number
  ): Promise<NotaCreditoResult> {
    try {
      const contribuyente = this.getValidatedConfig();
      const actividad = contribuyente.actividad === 'bienes' ? 'bienes' : 'servicios';

      const { data: comprobanteOriginal, error: fetchError } = await supabase
        .from('comprobantes')
        .select(`
          tipo_comprobante,
          numero_comprobante,
          punto_venta,
          fecha,
          cliente_cuit,
          cliente_doc_tipo,
          cliente_doc_nro,
          cliente_nombre,
          cliente_domicilio,
          cliente_condicion_iva
        `)
        .eq('id', comprobanteId)
        .single();

      if (fetchError || !comprobanteOriginal) {
        throw new Error('No se pudo obtener el comprobante original');
      }

      const numeroComprobanteOriginal = comprobanteOriginal.numero_comprobante || numeroComprobante;
      const cbteNroStr = numeroComprobanteOriginal.split('-').pop() || '1';
      const cbteNro = parseInt(cbteNroStr, 10);
      const fechaOriginal = comprobanteOriginal.fecha.replace(/-/g, '');
      const accessToken = await this.getFreshAccessToken();
      const clienteDocData = getClienteDocData({
        cuit: comprobanteOriginal.cliente_cuit,
        doc_tipo: comprobanteOriginal.cliente_doc_tipo,
        doc_nro: comprobanteOriginal.cliente_doc_nro,
      });

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/arca-proxy?action=crear-nota-credito`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: environment.supabase.anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            punto_venta: contribuyente.punto_venta,
            punto_venta_original: comprobanteOriginal.punto_venta ?? contribuyente.punto_venta,
            tipo_comprobante_original: comprobanteOriginal.tipo_comprobante,
            monto,
            concepto_afip: this.getConceptoAfip(actividad),
            iva_porcentaje: contribuyente.iva_porcentaje,
            cbte_asociado_nro: cbteNro,
            cbte_asociado_fecha: fechaOriginal,
            fecha: this.getFechaLocalISO(),
            doc_tipo: clienteDocData.docTipo,
            doc_nro: clienteDocData.docNro,
            condicion_iva_receptor_id: getCondicionIvaReceptorId(
              comprobanteOriginal.cliente_condicion_iva
            ),
          }),
        }
      );

      const responseData: ArcaProxyResponse = await response.json();

      if (!response.ok || !responseData.success || !responseData.data) {
        throw new Error(responseData.error || 'Error al crear nota de credito');
      }

      const tipoNC = getNotaCreditoTipo(comprobanteOriginal.tipo_comprobante);
      const ncNumero = this.formatNumeroComprobante(
        responseData.data.PtoVta,
        responseData.data.CbteDesde
      );

      const { data: ncComprobante, error: insertError } = await supabase
        .from('comprobantes')
        .insert({
          contribuyente_id: contribuyente.id,
          tipo_comprobante: tipoNC,
          numero_comprobante: ncNumero,
          punto_venta: contribuyente.punto_venta,
          fecha: this.getFechaLocalISO(),
          total: monto,
          cae: responseData.data.CAE,
          vencimiento_cae: responseData.data.CAEFchVto,
          estado: 'emitida',
          concepto: `Anulacion de ${numeroComprobanteOriginal}`,
          pdf_url: null,
          comprobante_asociado_id: comprobanteId,
          cliente_cuit: sanitizeCuit(comprobanteOriginal.cliente_cuit) || null,
          cliente_doc_tipo: clienteDocData.docTipo,
          cliente_doc_nro: clienteDocData.docNro,
          cliente_nombre: comprobanteOriginal.cliente_nombre || null,
          cliente_domicilio: comprobanteOriginal.cliente_domicilio || null,
          cliente_condicion_iva: normalizeCondicionIva(
            comprobanteOriginal.cliente_condicion_iva
          ),
        })
        .select()
        .single();

      if (insertError) {
        throw new Error('Error al guardar la nota de credito en la base de datos');
      }

      const { error: updateError } = await supabase
        .from('comprobantes')
        .update({ estado: 'anulada' })
        .eq('id', comprobanteId);

      if (updateError) {
        console.error('Error al actualizar estado de comprobante:', updateError);
      }

      return {
        success: true,
        data: {
          numero: ncNumero,
          cae: responseData.data.CAE,
          vencimiento_cae: responseData.data.CAEFchVto,
          pdf_url: undefined,
          comprobante: ncComprobante,
        },
      };
    } catch (error) {
      const isRetryable = (error as any)?.shouldRetry === true;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        shouldRetry: isRetryable,
      };
    }
  }

  async buscarClientePorCuit(cuit: string): Promise<ClienteLookupResult> {
    const cuitSanitizado = sanitizeCuit(cuit);

    if (cuitSanitizado.length !== 11) {
      throw new Error('El CUIT debe tener 11 digitos.');
    }

    const accessToken = await this.getFreshAccessToken();

    const response = await fetch(`${this.supabaseUrl}/functions/v1/padron-lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: environment.supabase.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ cuit: cuitSanitizado }),
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'No se pudo obtener datos del CUIT');
    }

    return {
      cuit: cuitSanitizado,
      nombre: result.data?.razon_social || null,
      domicilio: result.data?.domicilio || null,
      condicion_iva: result.data?.condicion_iva || 'Consumidor Final',
      doc_tipo: 80,
      doc_nro: Number(cuitSanitizado),
      condicion_iva_normalizada: normalizeCondicionIva(result.data?.condicion_iva),
    };
  }

  private buildClienteFacturaData(facturaData: FacturaRequestData) {
    const docData = getClienteDocData({
      cuit: facturaData.cliente_cuit,
    });

    return {
      cliente_cuit: sanitizeCuit(facturaData.cliente_cuit) || null,
      cliente_doc_tipo: docData.docTipo,
      cliente_doc_nro: docData.docNro,
      cliente_nombre: facturaData.cliente_nombre?.trim() || null,
      cliente_domicilio: facturaData.cliente_domicilio?.trim() || null,
      cliente_condicion_iva: normalizeCondicionIva(facturaData.cliente_condicion_iva),
    };
  }
}
