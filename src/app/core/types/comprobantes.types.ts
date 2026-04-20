import { Comprobante } from './database.types';

export type EstadoComprobanteVista = 'emitida' | 'anulada';

export interface ComprobanteListadoItem {
  id: string;
  numero_factura: string;
  fecha: string;
  monto: number;
  estado: EstadoComprobanteVista;
  cae?: string;
  vencimiento_cae?: string;
  tipo_comprobante: string;
  pdf_url?: string;
  concepto?: string;
  punto_venta?: number;
  cliente_cuit?: string;
  cliente_nombre?: string;
  cliente_domicilio?: string;
  cliente_condicion_iva?: string;
  cliente_doc_tipo?: number;
  cliente_doc_nro?: number;
  created_at?: string;
  updated_at?: string;
  factura_anulada?: string;
  comprobante_asociado_id?: string;
  nota_credito_anuladora?: string;
}

export interface NotaCreditoEmitida {
  numero?: string;
  cae?: string;
  vencimiento_cae?: string;
  pdf_url?: string;
  monto: number;
  facturaOriginal: string;
  tipo_comprobante?: string;
  notaCredito?: Comprobante;
}

export interface ComprobanteMetricRow {
  fecha: string;
  total: number;
  estado: string;
  tipo_comprobante: string;
  esNotaCredito: boolean;
}
