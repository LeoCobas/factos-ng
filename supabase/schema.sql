-- ============================================================
-- FACTOS-NG Multi-Tenant Schema v3 (Arca SDK)
-- 1 usuario = 1 contribuyente
-- Tabla única "comprobantes" (facturas + notas de crédito)
-- Facturación directa con ARCA/AFIP via Arca SDK
-- ============================================================

-- =========================
-- 1. TABLA: contribuyentes (1:1 con auth.users)
-- =========================
CREATE TABLE contribuyentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  cuit TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  -- Config de facturación
  concepto TEXT DEFAULT 'Servicios profesionales',
  actividad TEXT DEFAULT 'servicios' CHECK (actividad IN ('bienes', 'servicios')),
  iva_porcentaje NUMERIC DEFAULT 21.00,
  punto_venta INTEGER DEFAULT 4,
  tipo_comprobante_default TEXT DEFAULT 'FACTURA C',
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contribuyentes_user_id ON contribuyentes(user_id);

-- =========================
-- 2. TABLA: comprobantes (Facturas + Notas de Crédito unificadas)
-- =========================
CREATE TABLE comprobantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribuyente_id UUID NOT NULL REFERENCES contribuyentes(id) ON DELETE CASCADE,
  -- Tipo: 'FACTURA B', 'FACTURA C', 'NOTA DE CREDITO B', 'NOTA DE CREDITO C'
  tipo_comprobante TEXT NOT NULL,
  numero_comprobante TEXT NOT NULL,
  punto_venta INTEGER,
  fecha DATE NOT NULL,
  total NUMERIC NOT NULL,
  cae TEXT,
  vencimiento_cae TEXT,
  estado TEXT DEFAULT 'emitida' CHECK (estado IN ('emitida', 'anulada')),
  concepto TEXT,
  pdf_url TEXT,
  afip_id INTEGER,
  -- Self-reference: la NC apunta a la factura que anula
  comprobante_asociado_id UUID REFERENCES comprobantes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comprobantes_contribuyente_id ON comprobantes(contribuyente_id);
CREATE INDEX idx_comprobantes_fecha ON comprobantes(fecha);
CREATE INDEX idx_comprobantes_contribuyente_fecha ON comprobantes(contribuyente_id, fecha);
CREATE INDEX idx_comprobantes_asociado ON comprobantes(comprobante_asociado_id);

-- =========================
-- 3. TABLA: wsaa_tickets (Cache de tickets de autenticación WSAA)
-- =========================
CREATE TABLE wsaa_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuit TEXT NOT NULL,
  service_name TEXT NOT NULL, -- 'wsfe', 'ws_sr_padron_a4', etc.
  credentials JSONB NOT NULL, -- { header: {...}, credentials: {...} }
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cuit, service_name)
);

-- =========================
-- 4. ROW LEVEL SECURITY
-- =========================

ALTER TABLE contribuyentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;
-- wsaa_tickets: NO RLS (solo Edge Functions con service_role acceden)

-- Contribuyentes: solo acceder al propio
CREATE POLICY "contribuyentes_select_own"
  ON contribuyentes FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "contribuyentes_insert_own"
  ON contribuyentes FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "contribuyentes_update_own"
  ON contribuyentes FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "contribuyentes_delete_own"
  ON contribuyentes FOR DELETE
  USING (user_id = (select auth.uid()));

-- Comprobantes: solo acceder a los del contribuyente propio
CREATE POLICY "comprobantes_select_own"
  ON comprobantes FOR SELECT
  USING (
    contribuyente_id IN (
      SELECT id FROM contribuyentes WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "comprobantes_insert_own"
  ON comprobantes FOR INSERT
  WITH CHECK (
    contribuyente_id IN (
      SELECT id FROM contribuyentes WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "comprobantes_update_own"
  ON comprobantes FOR UPDATE
  USING (
    contribuyente_id IN (
      SELECT id FROM contribuyentes WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    contribuyente_id IN (
      SELECT id FROM contribuyentes WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "comprobantes_delete_own"
  ON comprobantes FOR DELETE
  USING (
    contribuyente_id IN (
      SELECT id FROM contribuyentes WHERE user_id = (select auth.uid())
    )
  );

-- =========================
-- 5. TRIGGER: auto-update updated_at
-- =========================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER set_updated_at_contribuyentes
  BEFORE UPDATE ON contribuyentes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_comprobantes
  BEFORE UPDATE ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
