ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

DROP POLICY IF EXISTS "contribuyentes_select_own" ON contribuyentes;
DROP POLICY IF EXISTS "contribuyentes_insert_own" ON contribuyentes;
DROP POLICY IF EXISTS "contribuyentes_update_own" ON contribuyentes;
DROP POLICY IF EXISTS "contribuyentes_delete_own" ON contribuyentes;

DROP POLICY IF EXISTS "comprobantes_select_own" ON comprobantes;
DROP POLICY IF EXISTS "comprobantes_insert_own" ON comprobantes;
DROP POLICY IF EXISTS "comprobantes_update_own" ON comprobantes;
DROP POLICY IF EXISTS "comprobantes_delete_own" ON comprobantes;

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
;
