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
          monto_maximo_factura: number | null;
          arca_cert: string | null;
          arca_key: string | null;
          arca_production: boolean | null;
          arca_ticket: Json | null;
          mp_access_token: string | null;
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
          monto_maximo_factura?: number | null;
          arca_cert?: string | null;
          arca_key?: string | null;
          arca_production?: boolean | null;
          arca_ticket?: Json | null;
          mp_access_token?: string | null;
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
          monto_maximo_factura?: number | null;
          arca_cert?: string | null;
          arca_key?: string | null;
          arca_production?: boolean | null;
          arca_ticket?: Json | null;
          mp_access_token?: string | null;
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
          cliente_cuit: string | null;
          cliente_doc_tipo: number | null;
          cliente_doc_nro: number | null;
          cliente_nombre: string | null;
          cliente_domicilio: string | null;
          cliente_condicion_iva: string | null;
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
          cliente_cuit?: string | null;
          cliente_doc_tipo?: number | null;
          cliente_doc_nro?: number | null;
          cliente_nombre?: string | null;
          cliente_domicilio?: string | null;
          cliente_condicion_iva?: string | null;
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
          cliente_cuit?: string | null;
          cliente_doc_tipo?: number | null;
          cliente_doc_nro?: number | null;
          cliente_nombre?: string | null;
          cliente_domicilio?: string | null;
          cliente_condicion_iva?: string | null;
          comprobante_asociado_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      ultimo_comprobante_cache: {
        Row: {
          id: string;
          contribuyente_id: string;
          punto_venta: number;
          tipo_comprobante: string;
          cbte_tipo: number;
          ultimo_comprobante: number;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contribuyente_id: string;
          punto_venta: number;
          tipo_comprobante: string;
          cbte_tipo: number;
          ultimo_comprobante: number;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contribuyente_id?: string;
          punto_venta?: number;
          tipo_comprobante?: string;
          cbte_tipo?: number;
          ultimo_comprobante?: number;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
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
export type UltimoComprobanteCache =
  Database['public']['Tables']['ultimo_comprobante_cache']['Row'];
