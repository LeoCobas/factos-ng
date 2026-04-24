CREATE OR REPLACE FUNCTION public.merge_arca_ticket_bucket(
  p_bucket TEXT,
  p_ticket JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF p_bucket NOT IN ('wsfe', 'padron') THEN
    RAISE EXCEPTION 'Invalid ARCA ticket bucket: %', p_bucket;
  END IF;

  UPDATE public.contribuyentes
  SET arca_ticket = (
    WITH current_ticket AS (
      SELECT COALESCE(public.contribuyentes.arca_ticket, '{}'::JSONB) AS ticket
    ),
    current_buckets AS (
      SELECT
        CASE
          WHEN ticket ->> '__factos_ticket_store__' = 'true'
            THEN COALESCE(ticket -> 'buckets', '{}'::JSONB)
          WHEN JSONB_TYPEOF(ticket) = 'object' AND ticket <> '{}'::JSONB
            THEN JSONB_BUILD_OBJECT('wsfe', ticket)
          ELSE '{}'::JSONB
        END AS buckets
      FROM current_ticket
    ),
    next_buckets AS (
      SELECT
        CASE
          WHEN p_ticket IS NULL THEN buckets - p_bucket
          ELSE JSONB_SET(buckets, ARRAY[p_bucket], p_ticket, true)
        END AS buckets
      FROM current_buckets
    )
    SELECT JSONB_BUILD_OBJECT(
      '__factos_ticket_store__', true,
      'buckets', buckets
    )
    FROM next_buckets
  )
  WHERE user_id = (SELECT auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.merge_arca_ticket_bucket(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_arca_ticket_bucket(TEXT, JSONB) TO authenticated;
