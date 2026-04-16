-- ============================================================
-- FACTOS-NG Schema real alineado con app + Edge Functions
-- 1 usuario = 1 contribuyente
-- Tickets WSAA persistidos en contribuyentes.arca_ticket
-- Tabla unica "comprobantes" (facturas + notas de credito)
-- ============================================================

-- =========================
-- 1. TABLA: contribuyentes (1:1 con auth.users)
-- =========================
CREATE TABLE contribuyentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  cuit TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  nombre_fantasia TEXT,
  domicilio TEXT,
  ingresos_brutos TEXT,
  inicio_actividades DATE,
  -- Config de facturacion
  concepto TEXT DEFAULT 'Servicios profesionales',
  actividad TEXT DEFAULT 'servicios' CHECK (actividad IN ('bienes', 'servicios')),
  iva_porcentaje NUMERIC DEFAULT 21.00,
  punto_venta INTEGER DEFAULT 4,
  tipo_comprobante_default TEXT DEFAULT 'FACTURA C',
  -- Credenciales ARCA + cache de ticket WSAA
  arca_cert TEXT,
  arca_key TEXT,
  arca_production BOOLEAN DEFAULT false,
  arca_ticket JSONB,
  condicion_iva TEXT DEFAULT 'Responsable Monotributo',
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contribuyentes_user_id ON contribuyentes(user_id);

-- =========================
-- 2. TABLA: comprobantes (Facturas + Notas de Credito unificadas)
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
  cliente_cuit TEXT,
  cliente_doc_tipo INTEGER,
  cliente_doc_nro BIGINT,
  cliente_nombre TEXT,
  cliente_domicilio TEXT,
  cliente_condicion_iva TEXT,
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
-- 3. ROW LEVEL SECURITY
-- =========================

ALTER TABLE contribuyentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;

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
-- 4. TRIGGER: auto-update updated_at
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
