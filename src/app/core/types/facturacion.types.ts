// Tipos para la API de TusFacturas - Estructura que funciona exitosamente
// Basado en la implementación del proyecto anterior React

// ===== INTERFACES PRINCIPALES =====
export interface Cliente {
  documento_tipo: string;
  condicion_iva: string;
  condicion_iva_operacion?: string;
  domicilio: string;
  condicion_pago: string;
  documento_nro: string;
  razon_social: string;
  provincia: string;
  email: string;
  envia_por_mail: string;
  rg5329: string;
}

export interface Producto {
  descripcion: string;
  codigo: number;
  lista_precios: string;
  leyenda: string;
  unidad_bulto: number;
  alicuota: number;
  actualiza_precio: string;
  rg5329: string;
  precio_unitario_sin_iva: number;
}

export interface Detalle {
  cantidad: number;
  afecta_stock: string;
  actualiza_precio: string;
  bonificacion_porcentaje: number;
  producto: Producto;
}

export interface Comprobante {
  rubro: string;
  percepciones_iva: number;
  tipo: string;
  numero: number;
  bonificacion: number;
  operacion: string;
  detalle: Detalle[];
  fecha: string;
  vencimiento: string;
  rubro_grupo_contable: string;
  total: number;
  cotizacion: number;
  moneda: string;
  punto_venta: string;
  tributos: any[];
  datos_informativos?: { paga_misma_moneda?: 'S' | 'N' };
}

export interface FacturaRequest {
  apitoken: string;
  cliente: Cliente;
  apikey: string;
  comprobante: Comprobante;
  usertoken: string;
}

// ===== TIPOS DE ACTIVIDAD PARA VALIDACIÓN DE FECHAS =====
export type Actividad = 'bienes' | 'servicios';

// ===== RESPUESTA DE LA API =====
export interface FacturacionResponse {
  error?: string;
  errores?: string[];
  rta?: string; // "OK" si fue exitoso
  
  // Datos del comprobante emitido
  comprobante?: ComprobanteEmitido;
}

export interface ComprobanteEmitido {
  id: number;
  numero: number;
  fecha: string;
  tipo: string;
  total: number;
  cae: string;
  vencimiento_cae: string;
  punto_venta: number;
  moneda: string;
  cotizacion: number;
  
  // URLs para PDF
  url_pdf?: string;
  url_publica_pdf?: string;
}

// ===== TIPOS PARA NUESTRA BASE DE DATOS =====
export interface FacturaDB {
  id?: number;
  numero: number;
  fecha: string; // YYYY-MM-DD
  tipo_comprobante: string; // 'FC', 'ND', 'NC'
  total: number;
  cae: string;
  vencimiento_cae: string;
  punto_venta: number;
  pdf_url?: string; // URL en Supabase Storage
  tf_id: number; // ID de TusFacturas
  created_at?: string;
}

// ===== CONFIGURACIÓN PARA FACTURACIÓN =====
export interface ConfiguracionFacturacion {
  cuit: string;
  razon_social: string;
  punto_venta: number;
  concepto: number; // 1=Productos, 2=Servicios, 3=Productos y Servicios
  actividad: string; // Código de actividad AFIP
  iva_porcentaje: number; // 21, 10.5, 0, etc.
  tipo_comprobante_default: string; // 'FC', 'ND', 'NC'
  api_token: string;
  api_key: string;
  user_token: string;
}

// ===== ESTADOS DE UI =====
export type EstadoFacturacion = 'idle' | 'loading' | 'success' | 'error';

export interface ResultadoFacturacion {
  estado: EstadoFacturacion;
  factura?: ComprobanteEmitido;
  error?: string;
  mensajeError?: string;
}

// ===== DATOS DEL FORMULARIO =====
export interface FormularioFacturacion {
  monto: number;
  fecha: string; // YYYY-MM-DD
}
