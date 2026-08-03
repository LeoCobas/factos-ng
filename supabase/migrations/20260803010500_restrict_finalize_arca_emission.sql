revoke all on function public.finalize_arca_emission(
  uuid, integer, text, text, jsonb, boolean, jsonb
) from public;

revoke all on function public.finalize_arca_emission(
  uuid, integer, text, text, jsonb, boolean, jsonb
) from anon;

grant execute on function public.finalize_arca_emission(
  uuid, integer, text, text, jsonb, boolean, jsonb
) to authenticated;
