export interface Database {
  public: {
    Tables: {
      contribuyentes: {
        Row: {
          id: string;
          user_id: string;
          cuit: string;
          razon_social: string;
          concepto: string | null;
          actividad: 'bienes' | 'servicios' | null;
          iva_porcentaje: number;
          punto_venta: number;
          tipo_comprobante_default: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cuit: string;
          razon_social: string;
          concepto?: string | null;
          actividad?: 'bienes' | 'servicios' | null;
          iva_porcentaje?: number;
          punto_venta?: number;
          tipo_comprobante_default?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          cuit?: string;
          razon_social?: string;
          concepto?: string | null;
          actividad?: 'bienes' | 'servicios' | null;
          iva_porcentaje?: number;
          punto_venta?: number;
          tipo_comprobante_default?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      comprobantes: {
        Row: {
          id: string;
          contribuyente_id: string;
          tipo_comprobante: string;
          numero_comprobante: string;
          punto_venta: number | null;
          fecha: string;
          total: number;
          cae: string | null;
          vencimiento_cae: string | null;
          estado: 'emitida' | 'anulada';
          concepto: string | null;
          pdf_url: string | null;
          afip_id: number | null;
          comprobante_asociado_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contribuyente_id: string;
          tipo_comprobante: string;
          numero_comprobante: string;
          punto_venta?: number | null;
          fecha: string;
          total: number;
          cae?: string | null;
          vencimiento_cae?: string | null;
          estado?: 'emitida' | 'anulada';
          concepto?: string | null;
          pdf_url?: string | null;
          afip_id?: number | null;
          comprobante_asociado_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contribuyente_id?: string;
          tipo_comprobante?: string;
          numero_comprobante?: string;
          punto_venta?: number | null;
          fecha?: string;
          total?: number;
          cae?: string | null;
          vencimiento_cae?: string | null;
          estado?: 'emitida' | 'anulada';
          concepto?: string | null;
          pdf_url?: string | null;
          afip_id?: number | null;
          comprobante_asociado_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Tipos de conveniencia
export type Contribuyente = Database['public']['Tables']['contribuyentes']['Row'];
export type ContribuyenteInsert = Database['public']['Tables']['contribuyentes']['Insert'];
export type ContribuyenteUpdate = Database['public']['Tables']['contribuyentes']['Update'];

export type Comprobante = Database['public']['Tables']['comprobantes']['Row'];
export type ComprobanteInsert = Database['public']['Tables']['comprobantes']['Insert'];
export type ComprobanteUpdate = Database['public']['Tables']['comprobantes']['Update'];
