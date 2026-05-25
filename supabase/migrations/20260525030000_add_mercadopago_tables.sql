-- ============================================================
-- Mercado Pago integration: tables, RLS, triggers, Realtime
-- ============================================================

-- 1. Add MP access token to contribuyentes
ALTER TABLE contribuyentes
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT;

-- 2. Batch jobs table (Realtime-enabled for progress tracking)
CREATE TABLE mp_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribuyente_id UUID NOT NULL REFERENCES contribuyentes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  successful_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  ignored_items INTEGER NOT NULL DEFAULT 0,
  results JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mp_batch_jobs_contribuyente
  ON mp_batch_jobs(contribuyente_id, created_at DESC);

-- 3. Conciliaciones table (tracks processed MP payment IDs)
CREATE TABLE mp_conciliaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribuyente_id UUID NOT NULL REFERENCES contribuyentes(id) ON DELETE CASCADE,
  mp_payment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('facturado', 'ignorado', 'fallido')),
  mp_date_created TIMESTAMPTZ NOT NULL,
  mp_transaction_amount NUMERIC NOT NULL,
  mp_description TEXT,
  mp_payer_name TEXT,
  comprobante_id UUID REFERENCES comprobantes(id),
  error_message TEXT,
  batch_job_id UUID REFERENCES mp_batch_jobs(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contribuyente_id, mp_payment_id)
);

CREATE INDEX idx_mp_conciliaciones_contribuyente
  ON mp_conciliaciones(contribuyente_id);
CREATE INDEX idx_mp_conciliaciones_status
  ON mp_conciliaciones(contribuyente_id, status);
CREATE INDEX idx_mp_conciliaciones_mp_date
  ON mp_conciliaciones(contribuyente_id, mp_date_created DESC);

-- 4. RLS policies
ALTER TABLE mp_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_conciliaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_batch_jobs_select_own" ON mp_batch_jobs FOR SELECT
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_batch_jobs_insert_own" ON mp_batch_jobs FOR INSERT
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_batch_jobs_update_own" ON mp_batch_jobs FOR UPDATE
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "mp_conciliaciones_select_own" ON mp_conciliaciones FOR SELECT
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_conciliaciones_insert_own" ON mp_conciliaciones FOR INSERT
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_conciliaciones_update_own" ON mp_conciliaciones FOR UPDATE
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));

-- 5. Triggers (reuse existing update_updated_at_column)
CREATE TRIGGER set_updated_at_mp_batch_jobs
  BEFORE UPDATE ON mp_batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_mp_conciliaciones
  BEFORE UPDATE ON mp_conciliaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable Realtime for batch jobs progress
ALTER PUBLICATION supabase_realtime ADD TABLE mp_batch_jobs;
