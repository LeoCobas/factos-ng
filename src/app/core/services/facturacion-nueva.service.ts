import { Injectable, signal } from '@angular/core';
import { supabase } from './supabase.service';
import { 
  FacturaRequest, 
  FacturacionResponse, 
  ConfiguracionFacturacion, 
  FormularioFacturacion,
  Cliente,
  Producto,
  Detalle,
  Comprobante,
  Actividad,
  EstadoFacturacion,
  ResultadoFacturacion
} from '../types/facturacion.types';

interface NumeracionRequest {
  apitoken: string;
  apikey: string;
  usertoken: string;
  punto_venta: number;
  tipo_comprobante: string;
}

interface NumeracionResponse {
  success: boolean;
  ultimo_numero?: number;
  proximo_numero?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FacturacionNuevaService {
  private readonly supabaseUrl = 'https://tprqqdqtrzujrhvuqiha.supabase.co';
  
  // Señales reactivas para el estado
  public readonly estado = signal<EstadoFacturacion>('idle');
  public readonly resultado = signal<ResultadoFacturacion | null>(null);

  constructor() {}

  /**
   * Obtiene la configuración de facturación desde la base de datos
   */
  private async obtenerConfiguracion(): Promise<ConfiguracionFacturacion> {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error('No se pudo obtener la configuración');
    }

    return data as ConfiguracionFacturacion;
  }

  /**
   * Valida si la fecha es válida según el tipo de actividad
   */
  private isValidInvoiceDate(fecha: Date, actividad: Actividad): { isValid: boolean; error?: string } {
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    
    // No permitir fechas futuras
    if (daysDiff < 0) {
      return { isValid: false, error: 'No se pueden emitir facturas con fecha futura' };
    }
    
    // Verificar límites según actividad
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
   * Consulta la numeración de comprobantes
   */
  private async consultarNumeracion(
    config: ConfiguracionFacturacion,
    tipoComprobante: string = 'FACTURA B'
  ): Promise<NumeracionResponse> {
    try {
      const { data: { session } } = await this.supabaseService.getClient().auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const requestData: NumeracionRequest = {
        apitoken: config.api_token,
        apikey: config.api_key,
        usertoken: config.user_token,
        punto_venta: config.punto_venta,
        tipo_comprobante: tipoComprobante
      };

      const response = await fetch(`${this.supabaseUrl}/functions/v1/tf-proxy?path=${encodeURIComponent('facturacion/numeracion')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestData)
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData?.message || responseData?.errores?.join?.(', ') || 'Error al consultar numeración');
      }

      const ultimoNumero = responseData.ultimo_numero || 0;
      const proximoNumero = ultimoNumero + 1;

      return {
        success: true,
        ultimo_numero: ultimoNumero,
        proximo_numero: proximoNumero
      };

    } catch (error) {
      console.error('Error al consultar numeración:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al consultar numeración'
      };
    }
  }

  /**
   * Emite una factura electrónica usando la lógica que funcionaba en el proyecto anterior
   */
  async emitirFactura(formulario: FormularioFacturacion): Promise<void> {
    this.estado.set('loading');
    
    try {
      console.log('🚀 Iniciando emisión de factura...');
      
      // Obtener configuración
      const config = await this.obtenerConfiguracion();
      console.log('✅ Configuración obtenida');

      // Validar configuración
      if (!config.api_token || !config.api_key || !config.user_token || !config.cuit) {
        throw new Error('Configuración incompleta. Complete todos los campos de TusFacturas.');
      }

      // Validar fecha según actividad
      const actividad: Actividad = (config as any).actividad === 'bienes' ? 'bienes' : 'servicios';
      const fechaValidation = this.isValidInvoiceDate(new Date(formulario.fecha), actividad);
      if (!fechaValidation.isValid) {
        throw new Error(fechaValidation.error);
      }

      // Determinar tipo de comprobante
      const tipoComprobante: string = (config as any).tipo_comprobante_default || 'FACTURA B';
      const isFacturaC = tipoComprobante === 'FACTURA C';
      
      console.log(`📋 Tipo de comprobante: ${tipoComprobante}`);

      // Consultar numeración antes de emitir
      console.log('🔍 Consultando numeración...');
      const numeracionResult = await this.consultarNumeracion(config, tipoComprobante);
      if (numeracionResult.success) {
        console.log(`✅ Próximo número disponible: ${numeracionResult.proximo_numero}`);
      }

      // Calcular montos según tipo de comprobante
      const montoSinIva = isFacturaC
        ? formulario.monto
        : (formulario.monto / (1 + config.iva_porcentaje / 100));

      // Preparar cliente (consumidor final)
      const cliente: Cliente = {
        documento_tipo: 'OTRO', // Para consumidor final sin DNI
        condicion_iva: 'CF', // Consumidor Final
        condicion_iva_operacion: 'CF',
        domicilio: 'Sin especificar',
        condicion_pago: '201', // Contado
        documento_nro: '0',
        razon_social: 'Consumidor Final',
        provincia: '2', // Buenos Aires
        email: '',
        envia_por_mail: 'N',
        rg5329: 'N'
      };

      // Preparar detalle del producto/servicio
      const detalle: Detalle = {
        cantidad: 1,
        afecta_stock: 'N',
        actualiza_precio: 'N',
        bonificacion_porcentaje: 0,
        producto: {
          descripcion: config.concepto.toString(),
          codigo: 1,
          lista_precios: 'standard',
          leyenda: '',
          unidad_bulto: 1,
          alicuota: isFacturaC ? 0 : config.iva_porcentaje, // Factura C no lleva IVA
          actualiza_precio: 'N',
          rg5329: 'N',
          precio_unitario_sin_iva: montoSinIva
        }
      };

      // Preparar comprobante
      const padPv = String(config.punto_venta).padStart(4, '0');
      const comprobante: Comprobante = {
        rubro: config.concepto.toString(),
        percepciones_iva: 0,
        tipo: tipoComprobante,
        numero: undefined as unknown as number, // TusFacturas asigna automáticamente
        bonificacion: 0,
        operacion: 'V', // Venta
        detalle: [detalle],
        fecha: formulario.fecha,
        vencimiento: formulario.fecha,
        rubro_grupo_contable: config.concepto.toString(),
        total: formulario.monto,
        cotizacion: 1,
        moneda: 'PES',
        punto_venta: padPv,
        tributos: [],
        datos_informativos: { paga_misma_moneda: 'N' }
      };

      // Preparar request completo
      const requestData: FacturaRequest = {
        apitoken: config.api_token,
        cliente,
        apikey: config.api_key,
        comprobante,
        usertoken: config.user_token
      };

      console.log('📤 Enviando factura a TusFacturas...', requestData);

      // Llamar a la API
      const resultado = await this.llamarTusFacturas(requestData);
      
      if (!resultado.success) {
        throw new Error(resultado.error || 'Error al emitir factura');
      }

      console.log('✅ Factura emitida exitosamente:', resultado.data);

      // Guardar en base de datos
      const supabase = this.supabaseService.getClient();
      const { data: factura, error: facturaError } = await supabase
        .from('facturas')
        .insert({
          numero_factura: resultado.data?.numero || `TEMP-${Date.now()}`,
          fecha: formulario.fecha,
          monto: formulario.monto,
          concepto: config.concepto.toString(),
          iva_porcentaje: config.iva_porcentaje,
          punto_venta: config.punto_venta,
          estado: 'emitida',
          afip_id: resultado.data?.afip_id,
          pdf_url: resultado.data?.pdf_url,
          tipo_comprobante: tipoComprobante,
          cae: resultado.data?.cae,
          cae_vto: resultado.data?.cae_vto
        })
        .select()
        .single();

      if (facturaError) {
        console.error('Error al guardar factura:', facturaError);
        throw new Error('No se pudo guardar la factura en la base de datos');
      }

      // Establecer resultado exitoso
      this.estado.set('success');
      this.resultado.set({
        estado: 'success',
        factura: {
          id: parseInt(resultado.data?.numero || '0'),
          numero: parseInt(resultado.data?.numero || '0'),
          fecha: formulario.fecha,
          tipo: tipoComprobante,
          total: formulario.monto,
          cae: resultado.data?.cae || '',
          vencimiento_cae: resultado.data?.cae_vto || '',
          punto_venta: config.punto_venta,
          moneda: 'ARS',
          cotizacion: 1,
          url_pdf: resultado.data?.pdf_url
        }
      });

    } catch (error) {
      console.error('❌ Error en facturación:', error);
      this.estado.set('error');
      this.resultado.set({
        estado: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      throw error;
    }
  }

  /**
   * Llama a TusFacturas usando la misma estructura que funcionaba
   */
  private async llamarTusFacturas(requestData: FacturaRequest): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data: { session } } = await this.supabaseService.getClient().auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa');
      }

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
      
      // Manejar errores específicos de la API
      if (!response.ok || responseData?.error === 'S') {
        const errores = responseData?.errores || [];
        const errorMessage = responseData?.message || errores.join?.(', ') || 'Error al emitir factura';
        throw new Error(errorMessage);
      }

      // Parsear respuesta exitosa
      const isOk = (responseData && (responseData.error === 'N' || responseData.success === true));
      if (!isOk) {
        const errores = Array.isArray(responseData?.errores) ? responseData.errores as string[] : [];
        const errMsg = (responseData?.message as string) || (responseData?.rta as string) || (errores.length > 0 ? errores.join("; ") : 'Error al emitir comprobante');
        throw new Error(errMsg);
      }

      const numero = (responseData.comprobante_nro as string) || (responseData.numero as string) || '';
      const cae = ((responseData.cae as string) || '').toString().trim();
      const cae_vto = (responseData.vencimiento_cae as string) || (responseData.cae_vto as string) || '';
      const pdfTicket = (responseData.comprobante_ticket_url as string) || (responseData.pdf_ticket_url as string);
      const pdfA4 = (responseData.comprobante_pdf_url as string) || (responseData.pdf_url as string);
      const tipo = (responseData.comprobante_tipo as string) || (responseData.tipo as string);
      const afip_id = responseData.afip_id as string;

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
      console.error('Error en llamarTusFacturas:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Resetea el estado del servicio
   */
  resetearEstado(): void {
    this.estado.set('idle');
    this.resultado.set(null);
  }
}
