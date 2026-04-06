import { Injectable, inject } from '@angular/core';
import { supabase } from './supabase.service';
import { ContribuyenteService } from './contribuyente.service';
import { environment } from '../../../environments/environment';
import { Contribuyente } from '../types/database.types';

export interface FacturaRequestData {
  monto: number;
  fecha: string; // DD/MM/YYYY
}

export interface ConfigData {
  apitoken: string;
  apikey: string;
  usertoken: string;
  punto_venta: number;
  concepto: string;
  iva_porcentaje: number;
  cuit: string;
  razon_social: string;
  tipo_comprobante_default?: 'FACTURA B' | 'FACTURA C';
  actividad?: 'bienes' | 'servicios';
}

export interface TusFacturasResponse {
  error: 'S' | 'N';
  errores?: string[];
  message?: string;
  comprobante_nro?: string;
  numero?: string;
  cae?: string;
  vencimiento_cae?: string;
  cae_vto?: string;
  comprobante_pdf_url?: string;
  pdf_url?: string;
  comprobante_ticket_url?: string;
  pdf_ticket_url?: string;
  afip_id?: number;
  comprobante_tipo?: string;
  tipo?: string;
  mantenimiento?: number;
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

    if (!contribuyente.api_token || !contribuyente.api_key || !contribuyente.user_token || !contribuyente.cuit) {
      throw new Error('Configuración incompleta. Completá todos los campos de TusFacturas en Configuración.');
    }

    return contribuyente;
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

      const configFormatted: ConfigData = {
        apitoken: contribuyente.api_token!,
        apikey: contribuyente.api_key!,
        usertoken: contribuyente.user_token!,
        punto_venta: contribuyente.punto_venta,
        concepto: contribuyente.concepto || 'Servicios profesionales',
        iva_porcentaje: contribuyente.iva_porcentaje,
        cuit: contribuyente.cuit,
        razon_social: contribuyente.razon_social,
        tipo_comprobante_default: (contribuyente.tipo_comprobante_default as 'FACTURA B' | 'FACTURA C') || 'FACTURA B',
        actividad: actividad
      };

      const resultado = await this.llamarTusFacturas(configFormatted, facturaData);

      if (!resultado.success) {
        throw new Error(resultado.error || 'Error al emitir factura');
      }

      // Guardar en tabla comprobantes
      const { data: comprobante, error: insertError } = await supabase
        .from('comprobantes')
        .insert({
          contribuyente_id: contribuyente.id,
          tipo_comprobante: configFormatted.tipo_comprobante_default || 'FACTURA B',
          numero_comprobante: resultado.data?.numero || `TEMP-${Date.now()}`,
          punto_venta: contribuyente.punto_venta,
          fecha: `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`,
          total: facturaData.monto,
          cae: resultado.data?.cae,
          vencimiento_cae: resultado.data?.cae_vto,
          estado: 'emitida',
          concepto: contribuyente.concepto,
          pdf_url: resultado.data?.pdf_url,
          afip_id: resultado.data?.afip_id
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
          cae: resultado.data?.cae,
          vencimiento_cae: resultado.data?.cae_vto,
          pdf_url: resultado.data?.pdf_url
        }
      };

    } catch (error) {
      throw error;
    }
  }

  // Llamar a TusFacturas API
  private async llamarTusFacturas(config: ConfigData, facturaData: FacturaRequestData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const tipoComprobante = config.tipo_comprobante_default || 'FACTURA B';
      const isFacturaC = tipoComprobante === 'FACTURA C';
      const montoSinIva = isFacturaC ? facturaData.monto : (facturaData.monto / (1 + config.iva_porcentaje / 100));

      const requestData = {
        apitoken: config.apitoken,
        cliente: {
          documento_tipo: 'OTRO',
          condicion_iva: 'CF',
          condicion_iva_operacion: 'CF',
          domicilio: 'Sin especificar',
          condicion_pago: '201',
          documento_nro: '0',
          razon_social: 'Consumidor Final',
          provincia: '2',
          email: '',
          envia_por_mail: 'N',
          rg5329: 'N'
        },
        apikey: config.apikey,
        comprobante: {
          rubro: config.concepto,
          percepciones_iva: 0,
          tipo: tipoComprobante,
          numero: undefined,
          bonificacion: 0,
          operacion: 'V',
          detalle: [
            {
              cantidad: 1,
              afecta_stock: 'N',
              actualiza_precio: 'N',
              bonificacion_porcentaje: 0,
              producto: {
                descripcion: config.concepto,
                codigo: 1,
                lista_precios: 'standard',
                leyenda: '',
                unidad_bulto: 1,
                alicuota: isFacturaC ? 0 : config.iva_porcentaje,
                actualiza_precio: 'N',
                rg5329: 'N',
                precio_unitario_sin_iva: montoSinIva
              }
            }
          ],
          fecha: facturaData.fecha,
          vencimiento: facturaData.fecha,
          rubro_grupo_contable: config.concepto,
          total: facturaData.monto,
          cotizacion: 1,
          moneda: 'PES',
          punto_venta: String(config.punto_venta).padStart(4, '0'),
          tributos: [],
          datos_informativos: { paga_misma_moneda: 'N' }
        },
        usertoken: config.usertoken
      };

      const response = await fetch(`${this.supabaseUrl}/functions/v1/tf-proxy?path=${encodeURIComponent('facturacion/nuevo')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestData)
      });

      const responseData: TusFacturasResponse = await response.json();
      
      if (!response.ok || responseData?.error === 'S') {
        const errores = responseData?.errores || [];
        const errorMessage = responseData?.message || errores.join?.(', ') || 'Error al emitir factura';
        throw new Error(errorMessage);
      }

      const isOk = (responseData && (responseData.error === 'N'));
      if (!isOk) {
        const errores = Array.isArray(responseData?.errores) ? responseData.errores : [];
        const errMsg = responseData?.message || (errores.length > 0 ? errores.join("; ") : 'Error al emitir comprobante');
        throw new Error(errMsg);
      }

      const numero = responseData.comprobante_nro || responseData.numero || '';
      const cae = (responseData.cae || '').toString().trim();
      const cae_vto = responseData.vencimiento_cae || responseData.cae_vto || '';
      const pdfTicket = responseData.comprobante_ticket_url || responseData.pdf_ticket_url;
      const pdfA4 = responseData.comprobante_pdf_url || responseData.pdf_url;
      const afip_id = responseData.afip_id;

      return {
        success: true,
        data: {
          numero,
          cae,
          cae_vto,
          pdf_url: pdfTicket || pdfA4 || '',
          afip_id,
        }
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
        .select('tipo_comprobante, numero_comprobante')
        .eq('id', comprobanteId)
        .single();

      if (fetchError || !comprobanteOriginal) {
        throw new Error('No se pudo obtener el comprobante original');
      }

      const tipoNotaCredito = comprobanteOriginal.tipo_comprobante === 'FACTURA C' ? 'NOTA DE CREDITO C' : 'NOTA DE CREDITO B';
      const isNotaCreditoC = tipoNotaCredito === 'NOTA DE CREDITO C';
      const ivaPercentage = contribuyente.iva_porcentaje || 21;
      const montoSinIva = isNotaCreditoC ? monto : Number((monto / (1 + ivaPercentage / 100)).toFixed(2));

      const fechaActual = new Date();
      const fechaVencimiento = new Date(fechaActual);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

      const formatearFecha = (fecha: Date) => {
        const dd = String(fecha.getDate()).padStart(2, '0');
        const mm = String(fecha.getMonth() + 1).padStart(2, '0');
        const yyyy = fecha.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };

      const requestData = {
        usertoken: contribuyente.user_token,
        apikey: contribuyente.api_key,
        apitoken: contribuyente.api_token,
        cliente: {
          documento_tipo: 'OTRO',
          documento_nro: '0',
          razon_social: 'Consumidor Final',
          email: '',
          domicilio: 'Sin especificar',
          provincia: '2',
          envia_por_mail: 'N',
          condicion_pago: '211',
          condicion_iva: 'CF',
          condicion_iva_operacion: 'CF'
        },
        comprobante: {
          fecha: formatearFecha(fechaActual),
          vencimiento: formatearFecha(fechaVencimiento),
          tipo: tipoNotaCredito,
          operacion: 'V',
          punto_venta: String(contribuyente.punto_venta || 4).padStart(4, '0'),
          rubro: contribuyente.concepto || 'Servicios profesionales',
          detalle: [
            {
              cantidad: '1',
              producto: {
                descripcion: `Anulación de factura ${numeroComprobante}`,
                unidad_bulto: '1',
                codigo: 'ANULACION',
                precio_unitario_sin_iva: String(montoSinIva),
                alicuota: isNotaCreditoC ? '0' : String(ivaPercentage)
              }
            }
          ],
          bonificacion: '0.00',
          total: String(monto),
          comprobantes_asociados: [
            {
              tipo_comprobante: comprobanteOriginal.tipo_comprobante,
              punto_venta: String(contribuyente.punto_venta || 4),
              numero: parseInt(numeroComprobante.split('-').pop() || '1'),
              comprobante_fecha: formatearFecha(fechaActual),
              cuit: contribuyente.cuit || '0'
            }
          ]
        }
      };

      const response = await fetch(`${this.supabaseUrl}/functions/v1/tf-proxy?path=nota-credito`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error en TusFacturas: ${response.status} - ${errorText}`);
      }

      const responseData: TusFacturasResponse = await response.json();

      if (responseData.error === 'S') {
        const errorDetails = responseData.errores && responseData.errores.length > 0 
          ? responseData.errores 
          : ['Error desconocido en TusFacturas'];
        
        if (responseData.mantenimiento === 1) {
          throw Object.assign(
            new Error(`TusFacturas está en mantenimiento temporalmente. ${errorDetails.join(', ')}. Intenta nuevamente en unos minutos.`),
            { shouldRetry: true }
          );
        } else {
          throw new Error(`Error en TusFacturas: ${errorDetails.join(', ')}`);
        }
      }

      if (responseData.error !== 'N') {
        throw new Error('Respuesta inesperada de TusFacturas');
      }

      const numero = responseData.comprobante_nro || responseData.numero;
      const cae = responseData.cae;
      const vencimiento_cae = responseData.vencimiento_cae;
      const pdf_url = responseData.comprobante_pdf_url || responseData.pdf_ticket_url || '';

      if (!numero) {
        throw new Error('No se pudo obtener el número de la nota de crédito de TusFacturas');
      }

      // Guardar NC en tabla comprobantes con comprobante_asociado_id
      const { data: ncComprobante, error: insertError } = await supabase
        .from('comprobantes')
        .insert({
          contribuyente_id: contribuyente.id,
          tipo_comprobante: tipoNotaCredito,
          numero_comprobante: numero,
          punto_venta: contribuyente.punto_venta,
          fecha: new Date().toISOString().split('T')[0],
          total: monto,
          cae: cae,
          vencimiento_cae: vencimiento_cae,
          estado: 'emitida',
          concepto: `Anulación de ${numeroComprobante}`,
          pdf_url: pdf_url,
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
          numero,
          cae,
          vencimiento_cae,
          pdf_url,
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
