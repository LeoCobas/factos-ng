export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      contribuyentes: {
        Row: {
          id: string;
          user_id: string;
          cuit: string;
          razon_social: string;
          nombre_fantasia: string | null;
          domicilio: string | null;
          condicion_iva: string | null;
          ingresos_brutos: string | null;
          inicio_actividades: string | null;
          concepto: string | null;
          actividad: string | null;
          iva_porcentaje: number | null;
          punto_venta: number | null;
          tipo_comprobante_default: string | null;
          arca_cert: string | null;
          arca_key: string | null;
          arca_production: boolean | null;
          arca_ticket: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          cuit: string;
          razon_social: string;
          nombre_fantasia?: string | null;
          domicilio?: string | null;
          condicion_iva?: string | null;
          ingresos_brutos?: string | null;
          inicio_actividades?: string | null;
          concepto?: string | null;
          actividad?: string | null;
          iva_porcentaje?: number | null;
          punto_venta?: number | null;
          tipo_comprobante_default?: string | null;
          arca_cert?: string | null;
          arca_key?: string | null;
          arca_production?: boolean | null;
          arca_ticket?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          cuit?: string;
          razon_social?: string;
          nombre_fantasia?: string | null;
          domicilio?: string | null;
          condicion_iva?: string | null;
          ingresos_brutos?: string | null;
          inicio_actividades?: string | null;
          concepto?: string | null;
          actividad?: string | null;
          iva_porcentaje?: number | null;
          punto_venta?: number | null;
          tipo_comprobante_default?: string | null;
          arca_cert?: string | null;
          arca_key?: string | null;
          arca_production?: boolean | null;
          arca_ticket?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
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
          estado: string | null;
          concepto: string | null;
          pdf_url: string | null;
          afip_id: number | null;
          comprobante_asociado_id: string | null;
          created_at: string | null;
          updated_at: string | null;
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
          estado?: string | null;
          concepto?: string | null;
          pdf_url?: string | null;
          afip_id?: number | null;
          comprobante_asociado_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
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
          estado?: string | null;
          concepto?: string | null;
          pdf_url?: string | null;
          afip_id?: number | null;
          comprobante_asociado_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
    };
  };
}

export type Contribuyente = Database['public']['Tables']['contribuyentes']['Row'];
export type ContribuyenteInsert = Database['public']['Tables']['contribuyentes']['Insert'];
export type ContribuyenteUpdate = Database['public']['Tables']['contribuyentes']['Update'];

export type Comprobante = Database['public']['Tables']['comprobantes']['Row'];
export type ComprobanteInsert = Database['public']['Tables']['comprobantes']['Insert'];
export type ComprobanteUpdate = Database['public']['Tables']['comprobantes']['Update'];
