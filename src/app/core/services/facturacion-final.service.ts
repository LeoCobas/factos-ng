import { Injectable, signal } from '@angular/core';
import { supabase } from './supabase.service';

// Usar la lógica que funcionaba en el proyecto anterior React
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

@Injectable({
  providedIn: 'root'
})
export class FacturacionNuevaService {
  private readonly supabaseUrl = 'https://tprqqdqtrzujrhvuqiha.supabase.co';
  
  constructor() {}

  /**
   * Valida fecha según actividad (igual que en proyecto anterior)
   */
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

  /**
   * Emite factura usando la misma lógica del proyecto anterior React
   */
  async emitirFactura(facturaData: FacturaRequestData): Promise<any> {
    try {
      console.log('🚀 Iniciando emisión de factura...');
      
      // Obtener configuración
      const { data: config, error: configError } = await supabase
        .from('configuracion')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (configError || !config) {
        throw new Error('No se pudo obtener la configuración');
      }

      // Validar configuración
      if (!config.api_token || !config.api_key || !config.user_token || !config.cuit) {
        throw new Error('Configuración incompleta. Complete todos los campos de TusFacturas.');
      }

      // Validar fecha según actividad
      const actividad = config.actividad === 'bienes' ? 'bienes' : 'servicios';
      const [dia, mes, año] = facturaData.fecha.split('/');
      const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
      
      const fechaValidation = this.isValidInvoiceDate(fecha, actividad);
      if (!fechaValidation.isValid) {
        throw new Error(fechaValidation.error);
      }

      // Usar la estructura exacta que funcionaba en el proyecto React
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

      // Llamar usando la misma estructura que el proyecto React
      const resultado = await this.llamarTusFacturasOriginal(configFormatted, facturaData);

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
        console.error('Error al guardar factura:', facturaError);
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
      console.error('❌ Error en facturación:', error);
      throw error;
    }
  }

  /**
   * Implementa la lógica exacta del proyecto React que funcionaba
   */
  private async llamarTusFacturasOriginal(config: ConfigData, facturaData: FacturaRequestData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      // Determinar tipo de comprobante
      const tipoComprobante = config.tipo_comprobante_default || 'FACTURA B';
      const isFacturaC = tipoComprobante === 'FACTURA C';

      // Calcular montos según tipo
      const montoSinIva = isFacturaC
        ? facturaData.monto
        : (facturaData.monto / (1 + config.iva_porcentaje / 100));

      // Estructura exacta que funcionaba en el proyecto React
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

      console.log('📤 Enviando a TusFacturas:', requestData);

      const response = await fetch(`${this.supabaseUrl}/functions/v1/tf-proxy?path=${encodeURIComponent('facturacion/nuevo')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestData)
      });

      const responseData = await response.json();
      console.log('📥 Respuesta de TusFacturas:', responseData);
      
      // Manejar errores
      if (!response.ok || responseData?.error === 'S') {
        const errores = responseData?.errores || [];
        const errorMessage = responseData?.message || errores.join?.(', ') || 'Error al emitir factura';
        throw new Error(errorMessage);
      }

      // Parsear respuesta exitosa (igual que en React)
      const isOk = (responseData && (responseData.error === 'N' || responseData.success === true));
      if (!isOk) {
        const errores = Array.isArray(responseData?.errores) ? responseData.errores : [];
        const errMsg = responseData?.message || responseData?.rta || (errores.length > 0 ? errores.join("; ") : 'Error al emitir comprobante');
        throw new Error(errMsg);
      }

      const numero = responseData.comprobante_nro || responseData.numero || '';
      const cae = (responseData.cae || '').toString().trim();
      const cae_vto = responseData.vencimiento_cae || responseData.cae_vto || '';
      const pdfTicket = responseData.comprobante_ticket_url || responseData.pdf_ticket_url;
      const pdfA4 = responseData.comprobante_pdf_url || responseData.pdf_url;
      const tipo = responseData.comprobante_tipo || responseData.tipo;
      const afip_id = responseData.afip_id;

      return {
        success: true,
        data: {
          numero,
          cae,
          cae_vto,
          pdf_url: pdfTicket || pdfA4 || '',
          afip_id,
          tipo,
        }
      };

    } catch (error) {
      console.error('Error en llamarTusFacturasOriginal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
}
