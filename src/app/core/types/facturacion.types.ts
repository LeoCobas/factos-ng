// Tipos para la API de TusFacturas según documentación oficial
// https://developers.tusfacturas.app/api-factura-electronica-afip-facturacion-ventas/referencia-api-afip-arca

// ===== TIPOS DE COMPROBANTE =====
export interface TipoComprobante {
  id: number;
  nombre: string;
  codigo: string;
}

// ===== ESTRUCTURA DEL COMPROBANTE SEGÚN API =====
export interface ComprobanteRequest {
  // Datos obligatorios del comprobante
  fecha: string; // AAAA-MM-DD
  tipo: string; // FC, ND, NC
  moneda: string; // ARS
  idioma: number; // 1=Español
  cotizacion: number; // Cotización de la moneda (1 para ARS)
  
  // Cliente (para consumidor final)
  cliente: ClienteConsumidorFinal;
  
  // Detalle de la facturación
  detalle: DetalleItem[];
  
  // Bonificaciones, descuentos, etc (opcional)
  bonificacion?: number;
  descuento?: number;
  recargo?: number;
  
  // Observaciones (opcional)
  observaciones?: string;
}

// ===== CLIENTE CONSUMIDOR FINAL =====
export interface ClienteConsumidorFinal {
  documento_tipo: string; // "DNI", "LE", "LC", "CI", etc.
  documento_nro: string; // "0" para consumidor final
  razon_social: string; // "CONSUMIDOR FINAL"
  email?: string;
  domicilio?: string;
  provincia?: string;
  envia_por_mail?: string; // "S" o "N"
}

// ===== DETALLE DE ITEMS =====
export interface DetalleItem {
  cantidad: number;
  producto: ProductoServicio;
  precio_unitario: number;
  alicuota: number; // % de IVA (21, 10.5, 0, etc.)
  unidad_bulto?: number;
}

export interface ProductoServicio {
  descripcion: string;
  unidad_medida?: string;
  codigo?: string;
  codigo_barras?: string;
}

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
