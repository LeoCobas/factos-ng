export interface Database {
  public: {
    Tables: {
      clientes: {
        Row: {
          id: string;
          created_at: string;
          nombre: string;
          email: string | null;
          telefono: string | null;
          direccion: string | null;
          cuit: string | null;
          condicion_iva: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          nombre: string;
          email?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          cuit?: string | null;
          condicion_iva?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          nombre?: string;
          email?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          cuit?: string | null;
          condicion_iva?: string | null;
          user_id?: string;
        };
      };
      facturas: {
        Row: {
          id: string;
          created_at: string;
          numero: string;
          fecha: string;
          cliente_id: string;
          subtotal: number;
          iva: number;
          total: number;
          estado: string;
          user_id: string;
          cae: string | null;
          vencimiento_cae: string | null;
          punto_venta: number | null;
          tipo_comprobante: number | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          numero: string;
          fecha: string;
          cliente_id: string;
          subtotal: number;
          iva: number;
          total: number;
          estado?: string;
          user_id: string;
          cae?: string | null;
          vencimiento_cae?: string | null;
          punto_venta?: number | null;
          tipo_comprobante?: number | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          numero?: string;
          fecha?: string;
          cliente_id?: string;
          subtotal?: number;
          iva?: number;
          total?: number;
          estado?: string;
          user_id?: string;
          cae?: string | null;
          vencimiento_cae?: string | null;
          punto_venta?: number | null;
          tipo_comprobante?: number | null;
        };
      };
      items_factura: {
        Row: {
          id: string;
          factura_id: string;
          descripcion: string;
          cantidad: number;
          precio_unitario: number;
          total: number;
        };
        Insert: {
          id?: string;
          factura_id: string;
          descripcion: string;
          cantidad: number;
          precio_unitario: number;
          total: number;
        };
        Update: {
          id?: string;
          factura_id?: string;
          descripcion?: string;
          cantidad?: number;
          precio_unitario?: number;
          total?: number;
        };
      };
      configuracion: {
        Row: {
          id: string;
          user_id: string;
          api_key: string | null;
          punto_venta: number | null;
          actividad_principal: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          api_key?: string | null;
          punto_venta?: number | null;
          actividad_principal?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          api_key?: string | null;
          punto_venta?: number | null;
          actividad_principal?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notas_credito: {
        Row: {
          id: string;
          factura_id: string;
          numero_nota: string;
          fecha: string;
          monto: number;
          pdf_url: string | null;
          pdf_expires_at: string | null;
          afip_id: string | null;
          created_at: string;
          updated_at: string;
          cae: string | null;
          cae_vto: string | null;
          tipo_comprobante: string;
        };
        Insert: {
          id?: string;
          factura_id: string;
          numero_nota: string;
          fecha: string;
          monto: number;
          pdf_url?: string | null;
          pdf_expires_at?: string | null;
          afip_id?: string | null;
          created_at?: string;
          updated_at?: string;
          cae?: string | null;
          cae_vto?: string | null;
          tipo_comprobante: string;
        };
        Update: {
          id?: string;
          factura_id?: string;
          numero_nota?: string;
          fecha?: string;
          monto?: number;
          pdf_url?: string | null;
          pdf_expires_at?: string | null;
          afip_id?: string | null;
          created_at?: string;
          updated_at?: string;
          cae?: string | null;
          cae_vto?: string | null;
          tipo_comprobante?: string;
        };
      };
    };
  };
}
