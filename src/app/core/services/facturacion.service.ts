import { Injectable, inject } from '@angular/core';
import { supabase } from './supabase.service';
import { ContribuyenteService } from './contribuyente.service';
import { environment } from '../../../environments/environment';
import { Contribuyente } from '../types/database.types';

export interface FacturaRequestData {
  monto: number;
  fecha: string; // DD/MM/YYYY
}

/** Respuesta de la Edge Function arca-proxy */
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

@Injectable({
  providedIn: 'root'
})
export class FacturacionService {
  private readonly supabaseUrl = environment.supabase.url;
  private readonly contribuyenteService = inject(ContribuyenteService);
  
  constructor() {}

  // Valida fecha según actividad AFIP
  private isValidInvoiceDate(fecha: Date, actividad: 'bienes' | 'servicios'): { isValid: boolean; error?: string } {
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) {
      return { isValid: false, error: 'No se pueden emitir facturas con fecha futura' };
    }
    
    const maxDays = actividad === 'bienes' ? 5 : 10;
    if (daysDiff > maxDays) {
      return { 
        isValid: false, 
        error: `Para ${actividad} solo se permiten facturas hasta ${maxDays} días atrás según normativa ARCA` 
      };
    }
    
    return { isValid: true };
  }

  // Obtiene y valida el contribuyente activo
  private getValidatedConfig(): Contribuyente {
    const contribuyente = this.contribuyenteService.contribuyente();

    if (!contribuyente) {
      throw new Error('No hay contribuyente configurado. Ve a Configuración para completar tus datos.');
    }

    if (!contribuyente.cuit || !contribuyente.razon_social) {
      throw new Error('Configuración incompleta. Completá al menos CUIT y razón social en Configuración.');
    }

    return contribuyente;
  }

  /** Mapea concepto AFIP según actividad */
  private getConceptoAfip(actividad: 'bienes' | 'servicios'): number {
    return actividad === 'bienes' ? 1 : 2;
  }

  /** Convierte fecha DD/MM/YYYY a YYYY-MM-DD */
  private fechaDDMMYYYYtoISO(fecha: string): string {
    const [dia, mes, año] = fecha.split('/');
    return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  /** Convierte fecha DD/MM/YYYY a YYYYMMDD */
  private fechaDDMMYYYYtoAfip(fecha: string): string {
    const [dia, mes, año] = fecha.split('/');
    return `${año}${mes.padStart(2, '0')}${dia.padStart(2, '0')}`;
  }

  /** Formatea número de comprobante: PPPP-NNNNNNNN */
  private formatNumeroComprobante(ptoVta: number, cbteNro: number): string {
    return `${String(ptoVta).padStart(4, '0')}-${String(cbteNro).padStart(8, '0')}`;
  }

  private async getFreshAccessToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No hay sesión activa');
    }
    await supabase.auth.refreshSession();

    const { data: { session: freshSession } } = await supabase.auth.getSession();
    const accessToken = freshSession?.access_token ?? session.access_token;

    if (!accessToken) {
      throw new Error('No se pudo obtener un token de sesión válido');
    }

    return accessToken;
  }

  async emitirFactura(facturaData: FacturaRequestData): Promise<FacturaResult> {
    try {
      const contribuyente = this.getValidatedConfig();

      // Validar fecha según actividad
      const actividad = contribuyente.actividad === 'bienes' ? 'bienes' : 'servicios';
      const [dia, mes, año] = facturaData.fecha.split('/');
      const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
      
      const fechaValidation = this.isValidInvoiceDate(fecha, actividad);
      if (!fechaValidation.isValid) {
        throw new Error(fechaValidation.error);
      }

      const resultado = await this.llamarArca(contribuyente, facturaData);

      if (!resultado.success || !resultado.data) {
        throw new Error(resultado.error || 'Error al emitir factura');
      }

      const tipoComprobante = contribuyente.tipo_comprobante_default || 'FACTURA C';
      const numeroComprobante = this.formatNumeroComprobante(
        resultado.data.PtoVta,
        resultado.data.CbteDesde
      );

      // Guardar en tabla comprobantes
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
          pdf_url: null, // ARCA no genera PDFs
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
        }
      };

    } catch (error) {
      throw error;
    }
  }

  // Llamar a la Edge Function arca-proxy
  private async llamarArca(
    contribuyente: Contribuyente,
    facturaData: FacturaRequestData
  ): Promise<{ success: boolean; data?: ArcaProxyResponse['data']; error?: string }> {
    try {
      const accessToken = await this.getFreshAccessToken();
      

      const actividad = contribuyente.actividad === 'bienes' ? 'bienes' : 'servicios';

      const requestBody = {
        punto_venta: contribuyente.punto_venta,
        tipo_comprobante: contribuyente.tipo_comprobante_default || 'FACTURA C',
        monto: facturaData.monto,
        fecha: this.fechaDDMMYYYYtoISO(facturaData.fecha),
        concepto_afip: this.getConceptoAfip(actividad),
        iva_porcentaje: contribuyente.iva_porcentaje,
      };

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/arca-proxy?action=crear-factura`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

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
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  // Crear nota de crédito para anular factura
  async crearNotaCredito(comprobanteId: string, numeroComprobante: string, monto: number): Promise<NotaCreditoResult> {
    try {
      const contribuyente = this.getValidatedConfig();

      // Obtener datos del comprobante original
      const { data: comprobanteOriginal, error: fetchError } = await supabase
        .from('comprobantes')
        .select('tipo_comprobante, numero_comprobante, punto_venta, fecha')
        .eq('id', comprobanteId)
        .single();

      if (fetchError || !comprobanteOriginal) {
        throw new Error('No se pudo obtener el comprobante original');
      }

      // Extraer número del comprobante (parte después del guión)
      const cbteNroStr = numeroComprobante.split('-').pop() || '1';
      const cbteNro = parseInt(cbteNroStr);

      // Convertir fecha del comprobante original a formato YYYYMMDD
      const fechaOriginal = comprobanteOriginal.fecha.replace(/-/g, '');
      const accessToken = await this.getFreshAccessToken();


      const requestBody = {
        punto_venta: contribuyente.punto_venta,
        tipo_comprobante_original: comprobanteOriginal.tipo_comprobante,
        monto: monto,
        iva_porcentaje: contribuyente.iva_porcentaje,
        cbte_asociado_nro: cbteNro,
        cbte_asociado_fecha: fechaOriginal,
        cuit_asociado: contribuyente.cuit,
      };

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/arca-proxy?action=crear-nota-credito`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const responseData: ArcaProxyResponse = await response.json();

      if (!response.ok || !responseData.success || !responseData.data) {
        throw new Error(responseData.error || 'Error al crear nota de crédito');
      }

      const tipoNC = comprobanteOriginal.tipo_comprobante === 'FACTURA C' 
        ? 'NOTA DE CREDITO C' 
        : 'NOTA DE CREDITO B';

      const ncNumero = this.formatNumeroComprobante(
        responseData.data.PtoVta,
        responseData.data.CbteDesde
      );

      // Guardar NC en tabla comprobantes
      const { data: ncComprobante, error: insertError } = await supabase
        .from('comprobantes')
        .insert({
          contribuyente_id: contribuyente.id,
          tipo_comprobante: tipoNC,
          numero_comprobante: ncNumero,
          punto_venta: contribuyente.punto_venta,
          fecha: new Date().toISOString().split('T')[0],
          total: monto,
          cae: responseData.data.CAE,
          vencimiento_cae: responseData.data.CAEFchVto,
          estado: 'emitida',
          concepto: `Anulación de ${numeroComprobante}`,
          pdf_url: null,
          comprobante_asociado_id: comprobanteId
        })
        .select()
        .single();

      if (insertError) {
        throw new Error('Error al guardar la nota de crédito en la base de datos');
      }

      // Actualizar estado de la factura original a 'anulada'
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
          comprobante: ncComprobante
        }
      };

    } catch (error) {
      const isRetryable = (error as any)?.shouldRetry === true;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        shouldRetry: isRetryable
      };
    }
  }
}
