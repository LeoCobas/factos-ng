// Tipos TypeScript para la API de TusFacturas
// Basado en: https://developers.tusfacturas.app/api-factura-electronica-afip-facturacion-ventas/referencia-api-afip-arca

// ========================
// REQUEST TYPES
// ========================

export interface TusFacturasComprobante {
  fecha: string; // YYYY-MM-DD
  tipo: number; // 1=FC A, 6=FC B, 11=FC C, etc.
  operacion: string; // "V" para venta
  punto_venta: number; // 1-9999
  numero: number; // 1-99999999
  periodo_facturado_desde?: string; // YYYY-MM-DD (opcional)
  periodo_facturado_hasta?: string; // YYYY-MM-DD (opcional)
  fecha_vencimiento_pago?: string; // YYYY-MM-DD (opcional)
  renspa?: string; // max 15 chars (opcional)
  bonificacion?: number; // decimal 2 decimales (opcional)
  total: number; // decimal 2 decimales
  total_exento?: number; // decimal 2 decimales (opcional)
  total_gravado?: number; // decimal 2 decimales (opcional)
  total_iva?: number; // decimal 2 decimales (opcional)
  total_tributos?: number; // decimal 2 decimales (opcional)
  moneda?: string; // "PES" por defecto (opcional)
  cotizacion?: number; // decimal 6 decimales (opcional)
  observaciones?: string; // max 1000 chars (opcional)
  concepto: number; // 1=Productos, 2=Servicios, 3=Productos y Servicios
  actividad: number; // Actividad según AFIP
  cliente: TusFacturasCliente;
  detalle: TusFacturasDetalle[];
  iva?: TusFacturasIva[]; // (opcional)
  tributos?: TusFacturasTributo[]; // (opcional)
}

export interface TusFacturasCliente {
  documento_tipo: string; // "DNI", "CUIT", "CUIL", "99" (sin identificar)
  documento_nro: string; // max 11 chars
  razon_social: string; // max 250 chars
  email?: string; // max 250 chars (opcional)
  domicilio?: string; // max 250 chars (opcional)
  provincia?: number; // código provincia AFIP (opcional)
  codigo_postal?: string; // max 8 chars (opcional)
  condicion_iva: string; // "CF" (consumidor final), "RI" (responsable inscripto), etc.
  condicion_pago?: string; // max 250 chars (opcional)
}

export interface TusFacturasDetalle {
  cantidad: number; // decimal 6 decimales
  afip_codigo?: string; // max 50 chars (opcional)
  producto_codigo?: string; // max 50 chars (opcional)
  descripcion: string; // max 4000 chars
  precio_unitario: number; // decimal 6 decimales
  alicuota_iva?: number; // decimal 2 decimales (opcional)
  unidad_medida?: number; // código unidad AFIP (opcional, 7 por defecto)
  
  // Aliases para compatibilidad
  producto?: string;
  precio?: number;
  iva?: number;
  importe?: number;
}

export interface TusFacturasIva {
  alicuota: number; // decimal 2 decimales
  importe: number; // decimal 2 decimales
  
  // Alias para compatibilidad
  porcentaje?: number;
}

export interface TusFacturasTributo {
  id: number; // ID tributo
  descripcion: string; // max 250 chars
  base_imponible: number; // decimal 2 decimales
  alicuota: number; // decimal 2 decimales
  importe: number; // decimal 2 decimales
}

export interface TusFacturasRequest {
  apitoken: string;
  apikey: string;
  usertoken: string;
  comprobante: TusFacturasComprobante;
}

// ========================
// RESPONSE TYPES
// ========================

export interface TusFacturasResponse {
  error?: string;
  errores?: string[];
  rta?: string; // "S" = éxito, "N" = error
  cae?: string; // Código de autorización electrónica
  vencimiento_cae?: string; // YYYY-MM-DD
  numero_comprobante?: number;
  fecha_comprobante?: string; // YYYY-MM-DD
  tipo_comprobante?: number;
  punto_venta?: number;
  comprobante_pdf_url?: string; // URL del PDF
  observaciones_afip?: string;
  reproceso?: string; // "S" si es reproceso
  
  // Aliases para compatibilidad
  numero?: number;
  vencimiento?: string;
  pdf?: string;
}

// ========================
// APPLICATION TYPES
// ========================

export interface FacturaForm {
  monto: number;
  fecha: string; // YYYY-MM-DD
}

export interface FacturaResult {
  success: boolean;
  factura?: {
    id: string; // UUID de Supabase
    numero: number;
    tipo: string; // "FC C"
    monto: number;
    fecha: string;
    cae: string;
    vencimiento_cae: string;
    pdf_url?: string; // URL en Supabase Storage
    tf_pdf_url?: string; // URL original de TusFacturas
  };
  error?: string;
  tf_response?: TusFacturasResponse;
}

// ========================
// CONSTANTS
// ========================

export const TIPOS_COMPROBANTE = {
  FC_A: 1,
  FC_B: 6,
  FC_C: 11,
  NC_A: 3,
  NC_B: 8,
  NC_C: 13
} as const;

export const TIPOS_COMPROBANTE_NAMES = {
  1: 'FC A',
  6: 'FC B', 
  11: 'FC C',
  3: 'NC A',
  8: 'NC B',
  13: 'NC C'
} as const;

export const CONCEPTOS = {
  PRODUCTOS: 1,
  SERVICIOS: 2,
  PRODUCTOS_Y_SERVICIOS: 3
} as const;

export const CONDICIONES_IVA = {
  CONSUMIDOR_FINAL: 'CF',
  RESPONSABLE_INSCRIPTO: 'RI',
  EXENTO: 'EX',
  MONOTRIBUTO: 'MT'
} as const;

export const TIPOS_DOCUMENTO = {
  CUIT: 'CUIT',
  CUIL: 'CUIL', 
  DNI: 'DNI',
  SIN_IDENTIFICAR: '99'
} as const;

// ========================
// ESTADOS Y RESULTADOS
// ========================

export type EstadoFacturacion = 'emitiendo' | 'emitida' | 'error';

export interface ResultadoFacturacion {
  estado: EstadoFacturacion;
  factura?: FacturaEmitida;
  error?: string;
  errores?: string[];
  numeroAsignado?: number;
}

export interface FacturaEmitida {
  numero: number;
  fecha: string;
  tipo_comprobante: string;
  punto_venta: number;
  total: number;
  cae: string;
  vencimiento_cae: string;
  pdf_url?: string;
  tusfacturas_pdf_url?: string;
  cuit_emisor: string;
  created_at?: string;
}

export interface ConfiguracionFacturacion {
  cuit: string;
  razon_social: string;
  punto_venta: number;
  iva_porcentaje: number;
  concepto: string;
  actividad: string;
  tipo_comprobante_default: string;
  api_token: string;
  api_key: string;
  user_token: string;
}

// ========================
// TIPOS PARA SERVICIOS LEGACY
// ========================

export interface TusFacturasConfig {
  cuit: string;
  punto_venta: number;
  api_token: string;
  api_key: string;
  user_token: string;
}

export interface FacturaEmitir {
  monto: number;
  fecha: string;
  concepto: string;
}

export interface RespuestaEmision {
  success: boolean;
  data?: any;
  error?: string;
  comprobante?: TusFacturasComprobante;
}
