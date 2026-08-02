REVOKE EXECUTE ON FUNCTION public.get_arca_invoice_context(
  INTEGER,
  TEXT,
  INTEGER,
  TIMESTAMPTZ
) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_arca_invoice_context(
  INTEGER,
  TEXT,
  INTEGER,
  TIMESTAMPTZ
) TO authenticated;
