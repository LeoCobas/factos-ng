export interface PdfComprobanteData {
  tipo_comprobante: string;
  numero_comprobante: string;
  fecha: string;
  total: number;
  cae?: string | null;
  vencimiento_cae?: string | null;
  cliente_cuit?: string | null;
  cliente_doc_tipo?: number | null;
  cliente_doc_nro?: number | null;
  cliente_nombre?: string | null;
  cliente_domicilio?: string | null;
  cliente_condicion_iva?: string | null;
  punto_venta?: number | null;
  concepto?: string | null;
}

export interface PdfInfo<T extends PdfComprobanteData = PdfComprobanteData> {
  filename: string;
  title: string;
  text: string;
  factura: T;
}
