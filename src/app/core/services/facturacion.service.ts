import { Injectable, inject } from '@angular/core';
import { getRuntimeConfig } from '../config/runtime-config';
import { supabase } from './supabase.service';
import { ContribuyenteService } from './contribuyente.service';
import { Comprobante, Contribuyente } from '../types/database.types';
import {
  ClienteFiscalProfile,
  ClienteFacturaData,
  getClienteDocData,
  getCondicionIvaReceptorId,
  getNotaCreditoTipo,
  normalizeCondicionIva,
  resolveTipoComprobanteDetallado,
  sanitizeCuit,
} from '../utils/factura-cliente.util';
import { getFriendlyNetworkErrorMessage } from '../utils/network-error.util';

export interface FacturaRequestData {
  monto: number;
  fecha: string; // DD/MM/YYYY
  cliente_cuit?: string | null;
  cliente_nombre?: string | null;
  cliente_domicilio?: string | null;
  cliente_condicion_iva?: string | null;
  cliente_fiscal_profile?: ClienteFiscalProfile | null;
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
  comprobante?: Comprobante;
  error?: string;
}

export interface NotaCreditoResult {
  success: boolean;
  data?: {
    numero: string;
    cae?: string;
    vencimiento_cae?: string;
    pdf_url?: string;
    comprobante: Comprobante;
  };
  error?: string;
  shouldRetry?: boolean;
}

export interface FacturaReciente {
  id: string;
  fecha: string;
  tipo_comprobante: string;
  total: number;
  numero_comprobante: string;
  created_at: string | null;
}

export interface ClienteLookupResult extends ClienteFacturaData {
  condicion_iva_normalizada: string;
  fiscal_profile: ClienteFiscalProfile;
  fiscal_status_message: string;
  fiscal_status_reliable: boolean;
  fiscal_status_source: 'constancia_inscripcion';
}

type TipoComprobanteFiscal =
  | 'FACTURA A'
  | 'FACTURA B'
  | 'FACTURA C'
  | 'NOTA DE CREDITO A'
  | 'NOTA DE CREDITO B'
  | 'NOTA DE CREDITO C';

@Injectable({
  providedIn: 'root',
})
export class FacturacionService {
  private readonly contribuyenteService = inject(ContribuyenteService);

  /**
   * Valida la ventana fiscal permitida antes de emitir el comprobante.
   * Entrada: fecha del comprobante y actividad declarada.
   * Salida: bandera de validez y mensaje listo para UI.
   */
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

  /**
   * Exige un contribuyente operativo con identidad minima cargada.
   * Side effect: corta la emision si falta configuracion base del emisor.
   */
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

  private formatFechaArgentina(fechaISO: string): string {
    const [anio, mes, dia] = fechaISO.split('-');
    if (!anio || !mes || !dia) {
      return fechaISO;
    }

    return `${dia}/${mes}/${anio}`;
  }

  private formatNumeroComprobante(ptoVta: number, cbteNro: number): string {
    return `${String(ptoVta).padStart(4, '0')}-${String(cbteNro).padStart(8, '0')}`;
  }

  /**
   * Obtiene un access token vigente para invocar Edge Functions protegidas.
   * Refresca la sesion si vence en menos de 60 segundos.
   */
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

  /**
   * Contrato frontend -> backend para emitir factura.
   * Entrada: monto, fecha DD/MM/YYYY y datos fiscales del receptor.
   * Side effects: invoca `arca-proxy?action=crear-factura` y persiste en `comprobantes`.
   */
  async emitirFactura(facturaData: FacturaRequestData): Promise<FacturaResult> {
    const contribuyente = this.getValidatedConfig();
    const cliente = this.buildClienteFacturaData(facturaData);
    const tipoComprobante =
      facturaData.tipo_comprobante_resuelto ||
      resolveTipoComprobanteDetallado(
        contribuyente.condicion_iva,
        cliente.cliente_condicion_iva,
        facturaData.cliente_fiscal_profile,
      ).tipo;

    const actividad = contribuyente.actividad === 'bienes' ? 'bienes' : 'servicios';
    const [dia, mes, anio] = facturaData.fecha.split('/');
    const fecha = new Date(parseInt(anio, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
    const fechaValidation = this.isValidInvoiceDate(fecha, actividad);

    if (!fechaValidation.isValid) {
      throw new Error(fechaValidation.error);
    }

    await this.validarFechaNoAnteriorAUltimoTipo({
      contribuyenteId: contribuyente.id,
      tipoComprobante,
      fechaISO: this.fechaDDMMYYYYtoISO(facturaData.fecha),
      puntoVenta: contribuyente.punto_venta,
    });

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

  /**
   * Normaliza el payload requerido por `arca-proxy?action=crear-factura`.
   * Devuelve el contrato bruto de backend sin reinterpretar errores.
   */
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
          apikey: getRuntimeConfig().supabase.anonKey,
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
        error: getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'Error desconocido al emitir factura',
          'No se pudo emitir la factura porque no hay conexion a internet. Verifica la red e intenta nuevamente.'
        ),
      };
    }
  }

  /**
   * Contrato frontend -> backend para anular un comprobante via nota de credito.
   * Side effects: consulta el comprobante original, llama a ARCA y persiste ambos cambios en `comprobantes`.
   */
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
      const tipoNC = getNotaCreditoTipo(comprobanteOriginal.tipo_comprobante);
      const fechaNotaCredito = this.getFechaLocalISO();

      await this.validarFechaNoAnteriorAUltimoTipo({
        contribuyenteId: contribuyente.id,
        tipoComprobante: tipoNC,
        fechaISO: fechaNotaCredito,
        puntoVenta: contribuyente.punto_venta,
      });

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
            apikey: getRuntimeConfig().supabase.anonKey,
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
            fecha: fechaNotaCredito,
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
          fecha: fechaNotaCredito,
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
        error: getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'Error desconocido al crear nota de credito',
          'No se pudo crear la nota de credito porque no hay conexion a internet. Verifica la red e intenta nuevamente.'
        ),
        shouldRetry: isRetryable,
      };
    }
  }

  /**
   * Consulta `padron-lookup` y devuelve un perfil fiscal tipado para UI.
   * Entrada: CUIT libre; salida: respuesta normalizada con documento y clasificacion fiscal.
   */
  async buscarClientePorCuit(cuit: string): Promise<ClienteLookupResult> {
    const cuitSanitizado = sanitizeCuit(cuit);

    if (cuitSanitizado.length !== 11) {
      throw new Error('El CUIT debe tener 11 digitos.');
    }

    try {
      const accessToken = await this.getFreshAccessToken();

      const response = await fetch(`${this.supabaseUrl}/functions/v1/padron-lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: getRuntimeConfig().supabase.anonKey,
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
        fiscal_profile: result.data?.fiscal_profile || 'sin-datos',
        fiscal_status_message:
          result.data?.fiscal_status_message || 'No se pudo clasificar la constancia del cliente.',
        fiscal_status_reliable: result.data?.fiscal_status_reliable === true,
        fiscal_status_source: 'constancia_inscripcion',
      };
    } catch (error) {
      throw new Error(
        getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'No se pudo obtener datos del CUIT',
        ),
      );
    }
  }

  async cargarUltimaFechaComprobantePorTipo(
    contribuyenteId: string,
    tipoComprobante: TipoComprobanteFiscal | string,
    puntoVenta?: number | null,
  ): Promise<string | null> {
    let query = supabase
      .from('comprobantes')
      .select('fecha')
      .eq('contribuyente_id', contribuyenteId)
      .eq('tipo_comprobante', tipoComprobante)
      .eq('estado', 'emitida');

    if (Number.isInteger(puntoVenta) && Number(puntoVenta) > 0) {
      query = query.eq('punto_venta', Number(puntoVenta));
    }

    const { data, error } = await query
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error('No se pudo consultar la ultima fecha emitida para el tipo de comprobante');
    }

    return data?.fecha ?? null;
  }

  async validarFechaNoAnteriorAUltimoTipo(params: {
    contribuyenteId: string;
    tipoComprobante: TipoComprobanteFiscal | string;
    fechaISO: string;
    puntoVenta?: number | null;
  }): Promise<void> {
    const ultimaFecha = await this.cargarUltimaFechaComprobantePorTipo(
      params.contribuyenteId,
      params.tipoComprobante,
      params.puntoVenta,
    );

    if (ultimaFecha && params.fechaISO < ultimaFecha) {
      throw new Error(
        `No se puede emitir una ${params.tipoComprobante} con fecha anterior a la ultima autorizada para ese tipo: ${this.formatFechaArgentina(ultimaFecha)}`,
      );
    }
  }

  async cargarFacturasRecientes(contribuyenteId: string, limit = 3): Promise<FacturaReciente[]> {
    const { data, error } = await supabase
      .from('comprobantes')
      .select('id, fecha, tipo_comprobante, total, numero_comprobante, created_at')
      .eq('contribuyente_id', contribuyenteId)
      .eq('estado', 'emitida')
      .in('tipo_comprobante', ['FACTURA A', 'FACTURA B', 'FACTURA C'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error('No se pudieron cargar las facturas recientes');
    }

    return (data || []).map((factura) => ({
      id: factura.id,
      fecha: factura.fecha,
      tipo_comprobante: factura.tipo_comprobante,
      total: Number(factura.total ?? 0),
      numero_comprobante: factura.numero_comprobante,
      created_at: factura.created_at,
    }));
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

  private get supabaseUrl(): string {
    return getRuntimeConfig().supabase.url;
  }
}
