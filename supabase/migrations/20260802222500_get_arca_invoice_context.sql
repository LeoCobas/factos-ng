CREATE OR REPLACE FUNCTION public.get_arca_invoice_context(
  p_punto_venta INTEGER,
  p_tipo_comprobante TEXT,
  p_cbte_tipo INTEGER,
  p_cache_cutoff TIMESTAMPTZ
)
RETURNS TABLE (
  contribuyente_id UUID,
  cuit TEXT,
  arca_cert TEXT,
  arca_key TEXT,
  arca_production BOOLEAN,
  arca_ticket JSONB,
  ultimo_comprobante INTEGER,
  cache_synced_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT
    c.id,
    c.cuit,
    c.arca_cert,
    c.arca_key,
    c.arca_production,
    c.arca_ticket,
    cache.ultimo_comprobante,
    cache.synced_at
  FROM public.contribuyentes AS c
  LEFT JOIN LATERAL (
    SELECT uc.ultimo_comprobante, uc.synced_at
    FROM public.ultimo_comprobante_cache AS uc
    WHERE uc.contribuyente_id = c.id
      AND uc.punto_venta = p_punto_venta
      AND uc.tipo_comprobante = p_tipo_comprobante
      AND uc.cbte_tipo = p_cbte_tipo
      AND uc.synced_at >= p_cache_cutoff
    ORDER BY uc.synced_at DESC
    LIMIT 1
  ) AS cache ON TRUE
  WHERE c.user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_arca_invoice_context(
  INTEGER,
  TEXT,
  INTEGER,
  TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_arca_invoice_context(
  INTEGER,
  TEXT,
  INTEGER,
  TIMESTAMPTZ
) TO authenticated;
