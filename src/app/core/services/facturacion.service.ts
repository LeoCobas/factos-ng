import { Injectable, signal } from '@angular/core';
import { supabase } from './supabase.service';
import { environment } from '../../../environments/environment';
import { 
  ComprobanteRequest, 
  FacturacionResponse, 
  ComprobanteEmitido, 
  ConfiguracionFacturacion,
  FormularioFacturacion,
  ResultadoFacturacion,
  EstadoFacturacion,
  FacturaDB,
  DetalleItem,
  ClienteConsumidorFinal
} from '../types/facturacion.types';

@Injectable({
  providedIn: 'root'
})
export class FacturacionService {
  private supabaseClient = supabase;
  private supabaseUrl = environment.supabase.url;
  
  // Señales para el estado
  public estadoFacturacion = signal<EstadoFacturacion>('idle');
  public ultimoResultado = signal<ResultadoFacturacion | null>(null);

  /**
   * Emite una factura completa: valida configuración, llama a TusFacturas, guarda en DB y descarga PDF
   */
  async emitirFactura(formulario: FormularioFacturacion): Promise<ResultadoFacturacion> {
    this.estadoFacturacion.set('loading');
    
    try {
      // 1. Obtener configuración
      const config = await this.obtenerConfiguracion();
      if (!config) {
        const error = 'No se encontró configuración válida';
        this.actualizarEstado('error', undefined, error);
        return { estado: 'error', error };
      }

      // 2. Construir comprobante según API TusFacturas
      const comprobante = this.construirComprobante(formulario, config);
      
      // 3. Validar datos antes de enviar
      const validacion = this.validarComprobante(comprobante);
      if (!validacion.valido) {
        this.actualizarEstado('error', undefined, validacion.error);
        return { estado: 'error', error: validacion.error };
      }

      // 4. Llamar a TusFacturas via Edge Function
      const respuestaTF = await this.llamarTusFacturas(comprobante);
      
      if (respuestaTF.error || !respuestaTF.comprobante) {
        const error = respuestaTF.error || 'Error desconocido de TusFacturas';
        this.actualizarEstado('error', undefined, error);
        return { estado: 'error', error };
      }

      // 5. Guardar en base de datos
      const facturaGuardada = await this.guardarFacturaEnDB(respuestaTF.comprobante);
      
      // 6. Descargar y guardar PDF en Supabase Storage
      await this.guardarPDFEnStorage(respuestaTF.comprobante);

      // 7. Actualizar estado de éxito
      this.actualizarEstado('success', respuestaTF.comprobante);
      
      return { 
        estado: 'success', 
        factura: respuestaTF.comprobante 
      };

    } catch (error) {
      console.error('❌ Error en emitirFactura:', error);
      const mensajeError = error instanceof Error ? error.message : 'Error inesperado';
      this.actualizarEstado('error', undefined, mensajeError);
      return { estado: 'error', error: mensajeError };
    }
  }

  /**
   * Obtiene la configuración desde Supabase
   */
  private async obtenerConfiguracion(): Promise<ConfiguracionFacturacion | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('configuracion')
        .select('*')
        .single();

      if (error) {
        console.error('Error obteniendo configuración:', error);
        return null;
      }

      return data as ConfiguracionFacturacion;
    } catch (error) {
      console.error('Error en obtenerConfiguracion:', error);
      return null;
    }
  }

  /**
   * Construye el comprobante según la estructura de TusFacturas
   */
  private construirComprobante(
    formulario: FormularioFacturacion, 
    config: ConfiguracionFacturacion
  ): any {
    console.log('construirComprobante - Entrada:', { formulario, config });
    
    // Convertir fecha de YYYY-MM-DD a DD/MM/YYYY como requiere TusFacturas
    const [año, mes, dia] = formulario.fecha.split('-');
    const fechaTusFacturas = `${dia}/${mes}/${año}`;
    
    // Cliente consumidor final según API
    const cliente = {
      documento_tipo: "DNI",
      documento_nro: "0", // Consumidor final
      razon_social: "CONSUMIDOR FINAL",
      envia_por_mail: "N",
      email: "",
      domicilio: "",
      provincia: ""
    };

    // Detalle del servicio/producto
    const detalle = [{
      cantidad: 1,
      producto: {
        descripcion: "Servicios Profesionales",
        unidad_medida: "unidad",
        codigo: "SERV001"
      },
      precio_unitario: formulario.monto,
      alicuota: config.iva_porcentaje
    }];

    const comprobante = {
      fecha: fechaTusFacturas, // DD/MM/YYYY
      tipo: config.tipo_comprobante_default || "FC", // Factura C
      operacion: "V", // V=Venta (obligatorio)
      punto_venta: config.punto_venta || 1,
      numero: null, // TusFacturas asigna automáticamente
      moneda: "ARS",
      idioma: 1,
      cotizacion: 1,
      concepto: 2, // 2=Servicios
      
      // Para servicios, se requiere periodo
      periodo_facturado_desde: fechaTusFacturas,
      periodo_facturado_hasta: fechaTusFacturas,
      
      cliente,
      detalle,
      
      // Observaciones
      observaciones: `Facturación electrónica - ${new Date().toLocaleString()}`
    };
    
    console.log('construirComprobante - Salida:', comprobante);
    return comprobante;
  }

  /**
   * Valida el comprobante antes de enviarlo
   */
  private validarComprobante(comprobante: any): { valido: boolean; error?: string } {
    // Validar fecha (DD/MM/YYYY)
    if (!comprobante.fecha || !/^\d{2}\/\d{2}\/\d{4}$/.test(comprobante.fecha)) {
      return { valido: false, error: 'Fecha inválida (debe ser DD/MM/YYYY)' };
    }

    // Validar tipo de comprobante
    if (!comprobante.tipo) {
      return { valido: false, error: 'Tipo de comprobante requerido' };
    }

    // Validar operación
    if (!comprobante.operacion) {
      return { valido: false, error: 'Operación requerida (V=Venta)' };
    }

    // Validar punto de venta
    if (!comprobante.punto_venta || comprobante.punto_venta <= 0) {
      return { valido: false, error: 'Punto de venta inválido' };
    }

    // Validar cliente
    if (!comprobante.cliente || !comprobante.cliente.documento_nro) {
      return { valido: false, error: 'Datos del cliente requeridos' };
    }

    // Validar detalle
    if (!comprobante.detalle || comprobante.detalle.length === 0) {
      return { valido: false, error: 'Debe incluir al menos un item' };
    }

    const monto = comprobante.detalle[0].precio_unitario;
    if (!monto || monto <= 0) {
      return { valido: false, error: 'El monto debe ser mayor a 0' };
    }

    // Validar que el monto tenga máximo 2 decimales
    const montoStr = monto.toString();
    const decimales = montoStr.includes('.') ? montoStr.split('.')[1] : '';
    if (decimales.length > 2) {
      return { valido: false, error: 'El monto no puede tener más de 2 decimales' };
    }

    // Validar concepto para servicios
    if (comprobante.concepto === 2) {
      if (!comprobante.periodo_facturado_desde || !comprobante.periodo_facturado_hasta) {
        return { valido: false, error: 'Para servicios se requiere periodo facturado' };
      }
    }

    return { valido: true };
  }

  /**
   * Llama a TusFacturas a través de la Edge Function
   */
  private async llamarTusFacturas(comprobante: any): Promise<FacturacionResponse> {
    try {
      console.log('🚀 Iniciando llamada a TusFacturas...');
      const { data: { session } } = await this.supabaseClient.auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      console.log('🔑 Sesión obtenida, haciendo request a tf-proxy...');
      const response = await fetch(`${this.supabaseUrl}/functions/v1/tf-proxy?path=facturacion/nuevo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(comprobante)
      });

      console.log(`📊 Response status: ${response.status}`);
      const responseText = await response.text();
      console.log(`📄 Response text: ${responseText}`);

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}: ${responseText}`);
      }

      let resultado: FacturacionResponse;
      try {
        resultado = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Error parsing JSON:', parseError);
        throw new Error(`Error parsing response: ${responseText}`);
      }
      
      // TusFacturas puede devolver error en el cuerpo aunque el HTTP sea 200
      if (resultado.error) {
        throw new Error(resultado.error);
      }

      if (resultado.errores && resultado.errores.length > 0) {
        throw new Error(resultado.errores.join(', '));
      }

      console.log('✅ Respuesta exitosa de TusFacturas');
      return resultado;

    } catch (error) {
      console.error('❌ Error llamando a TusFacturas:', error);
      throw error;
    }
  }

  /**
   * Guarda la factura en la base de datos de Supabase
   */
  private async guardarFacturaEnDB(comprobante: ComprobanteEmitido): Promise<FacturaDB> {
    try {
      const facturaDB: Omit<FacturaDB, 'id' | 'created_at'> = {
        numero: comprobante.numero,
        fecha: comprobante.fecha,
        tipo_comprobante: comprobante.tipo,
        total: comprobante.total,
        cae: comprobante.cae,
        vencimiento_cae: comprobante.vencimiento_cae,
        punto_venta: comprobante.punto_venta,
        tf_id: comprobante.id
      };

      const { data, error } = await this.supabaseClient
        .from('facturas')
        .insert(facturaDB)
        .select()
        .single();

      if (error) {
        throw new Error(`Error guardando en DB: ${error.message}`);
      }

      return data as FacturaDB;

    } catch (error) {
      console.error('Error guardando factura en DB:', error);
      throw error;
    }
  }

  /**
   * Descarga el PDF desde TusFacturas y lo guarda en Supabase Storage
   */
  private async guardarPDFEnStorage(comprobante: ComprobanteEmitido): Promise<string | null> {
    try {
      if (!comprobante.url_pdf) {
        console.warn('No se encontró URL del PDF');
        return null;
      }

      // Nombre del archivo en Storage con estructura organizada
      const fecha = new Date(comprobante.fecha);
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      
      const nombreArchivo = `${año}/${mes}/${dia}/${comprobante.tipo}_${comprobante.punto_venta.toString().padStart(4, '0')}_${comprobante.numero.toString().padStart(8, '0')}.pdf`;

      // Descargar PDF desde TusFacturas usando pdf-proxy
      const { data: { session } } = await this.supabaseClient.auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa para descargar PDF');
      }

      const pdfResponse = await fetch(
        `${this.supabaseUrl}/functions/v1/pdf-proxy?url=${encodeURIComponent(comprobante.url_pdf)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          }
        }
      );

      if (!pdfResponse.ok) {
        throw new Error(`Error descargando PDF: ${pdfResponse.status}`);
      }

      const pdfBlob = await pdfResponse.blob();

      // Subir a Supabase Storage
      const { data, error } = await this.supabaseClient.storage
        .from('facturas-pdf')
        .upload(nombreArchivo, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (error) {
        console.error('Error subiendo PDF a Storage:', error);
        return null;
      }

      // Actualizar la factura en DB con la URL del PDF
      await this.supabaseClient
        .from('facturas')
        .update({ pdf_url: data.path })
        .eq('tf_id', comprobante.id);

      return data.path;

    } catch (error) {
      console.error('Error guardando PDF en Storage:', error);
      return null;
    }
  }

  /**
   * Actualiza el estado interno del servicio
   */
  private actualizarEstado(
    estado: EstadoFacturacion, 
    factura?: ComprobanteEmitido, 
    error?: string
  ): void {
    this.estadoFacturacion.set(estado);
    this.ultimoResultado.set({
      estado,
      factura,
      error,
      mensajeError: error
    });
  }

  /**
   * Resetea el estado a idle
   */
  public resetearEstado(): void {
    this.estadoFacturacion.set('idle');
    this.ultimoResultado.set(null);
  }

  /**
   * Obtiene la URL pública de un PDF desde Supabase Storage
   */
  public async obtenerURLPDF(nombreArchivo: string): Promise<string | null> {
    try {
      const { data } = this.supabaseClient.storage
        .from('facturas-pdf')
        .getPublicUrl(nombreArchivo);

      return data.publicUrl;
    } catch (error) {
      console.error('Error obteniendo URL del PDF:', error);
      return null;
    }
  }

  /**
   * Formatea el número de comprobante con ceros a la izquierda
   */
  public formatearNumeroComprobante(numero: number): string {
    return numero.toString().padStart(8, '0');
  }

  /**
   * Formatea el monto con separador de miles y 2 decimales
   */
  public formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto);
  }
}
