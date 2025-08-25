import { Injectable } from '@angular/core';
import { supabase } from './supabase.service';
import { environment } from '../../../environments/environment';

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
  factura?: any;
  error?: string;
}

export interface NotaCreditoResult {
  success: boolean;
  data?: {
    numero: string;
    cae?: string;
    cae_vto?: string;
    pdf_url?: string;
    notaCredito: any;
  };
  error?: string;
  shouldRetry?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FacturacionService {
  private readonly supabaseUrl = environment.supabase.url;
  
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

  // Obtiene y valida configuración de Supabase
  private async getValidatedConfig() {
    const { data: config, error } = await supabase
      .from('configuracion')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !config) {
      throw new Error('No se pudo obtener la configuración');
    }

    if (!config.api_token || !config.api_key || !config.user_token || !config.cuit) {
      throw new Error('Configuración incompleta. Complete todos los campos de TusFacturas.');
    }

    return config;
  }

  
  async emitirFactura(facturaData: FacturaRequestData): Promise<FacturaResult> {
    try {
      const config = await this.getValidatedConfig();

      // Validar fecha según actividad
      const actividad = config.actividad === 'bienes' ? 'bienes' : 'servicios';
      const [dia, mes, año] = facturaData.fecha.split('/');
      const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
      
      const fechaValidation = this.isValidInvoiceDate(fecha, actividad);
      if (!fechaValidation.isValid) {
        throw new Error(fechaValidation.error);
      }

      const configFormatted: ConfigData = {
        apitoken: config.api_token,
        apikey: config.api_key,
        usertoken: config.user_token,
        punto_venta: config.punto_venta,
        concepto: config.concepto,
        iva_porcentaje: config.iva_porcentaje,
        cuit: config.cuit,
        razon_social: config.razon_social,
        tipo_comprobante_default: config.tipo_comprobante_default || 'FACTURA B',
        actividad: actividad
      };

      const resultado = await this.llamarTusFacturas(configFormatted, facturaData);

      if (!resultado.success) {
        throw new Error(resultado.error || 'Error al emitir factura');
      }

      // Guardar en base de datos
      const { data: factura, error: facturaError } = await supabase
        .from('facturas')
        .insert({
          numero_factura: resultado.data?.numero || `TEMP-${Date.now()}`,
          fecha: `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`,
          monto: facturaData.monto,
          concepto: config.concepto,
          iva_porcentaje: config.iva_porcentaje,
          punto_venta: config.punto_venta,
          estado: 'emitida',
          afip_id: resultado.data?.afip_id,
          pdf_url: resultado.data?.pdf_url,
          tipo_comprobante: configFormatted.tipo_comprobante_default,
          cae: resultado.data?.cae,
          cae_vto: resultado.data?.cae_vto
        })
        .select()
        .single();

      if (facturaError) {
        throw new Error('No se pudo guardar la factura en la base de datos');
      }

      return {
        success: true,
        factura: {
          ...factura,
          cae: resultado.data?.cae,
          cae_vto: resultado.data?.cae_vto,
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
      
      // Manejar errores
      if (!response.ok || responseData?.error === 'S') {
        const errores = responseData?.errores || [];
        const errorMessage = responseData?.message || errores.join?.(', ') || 'Error al emitir factura';
        throw new Error(errorMessage);
      }

      // Verificar respuesta exitosa
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
  async crearNotaCredito(facturaId: string, numeroFactura: string, monto: number): Promise<NotaCreditoResult> {
    try {
      const config = await this.getValidatedConfig();

      // Obtener datos de la factura original
      const { data: facturaOriginal, error: facturaError } = await supabase
        .from('facturas')
        .select('tipo_comprobante, numero_factura')
        .eq('id', facturaId)
        .single();

      if (facturaError || !facturaOriginal) {
        throw new Error('No se pudo obtener la factura original');
      }

      const tipoNotaCredito = facturaOriginal.tipo_comprobante === 'FACTURA C' ? 'NOTA DE CREDITO C' : 'NOTA DE CREDITO B';
      const isNotaCreditoC = tipoNotaCredito === 'NOTA DE CREDITO C';
      const ivaPercentage = config.iva_porcentaje || 21;
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
        usertoken: config.user_token,
        apikey: config.api_key,
        apitoken: config.api_token,
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
          punto_venta: String(config.punto_venta || 4).padStart(4, '0'),
          rubro: config.concepto || 'Servicios profesionales',
          detalle: [
            {
              cantidad: '1',
              producto: {
                descripcion: `Anulación de factura ${numeroFactura}`,
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
              tipo_comprobante: facturaOriginal.tipo_comprobante,
              punto_venta: String(config.punto_venta || 4),
              numero: parseInt(numeroFactura.split('-').pop() || '1'),
              comprobante_fecha: formatearFecha(fechaActual),
              cuit: config.cuit || '0'
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
      const cae_vto = responseData.vencimiento_cae;
      const pdf_url = responseData.comprobante_pdf_url || responseData.pdf_ticket_url || '';

      if (!numero) {
        throw new Error('No se pudo obtener el número de la nota de crédito de TusFacturas');
      }

      const { data: notaCredito, error: insertError } = await supabase
        .from('notas_credito')
        .insert({
          factura_id: facturaId,
          numero_nota: numero,
          fecha: new Date().toISOString().split('T')[0],
          monto: monto,
          pdf_url: pdf_url,
          cae: cae,
          cae_vto: cae_vto,
          tipo_comprobante: tipoNotaCredito
        })
        .select()
        .single();

      if (insertError) {
        throw new Error('Error al guardar la nota de crédito en la base de datos');
      }

      // Actualizar el estado de la factura original a 'anulada'
      const { error: updateError } = await supabase
        .from('facturas')
        .update({ estado: 'anulada' })
        .eq('id', facturaId);

      if (updateError) {
        console.error('Error al actualizar estado de factura:', updateError);
        // No lanzamos error aquí para no interrumpir el flujo, solo lo registramos
      }

      return {
        success: true,
        data: {
          numero,
          cae,
          cae_vto,
          pdf_url,
          notaCredito
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
