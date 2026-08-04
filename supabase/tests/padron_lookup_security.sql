begin;

do $$
declare
  v_user_id uuid;
  v_result record;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception 'Test requires one auth user fixture';
  end if;

  set local role service_role;

  select * into v_result
  from public.consume_padron_lookup_rate_limit(v_user_id, 2, 60);

  if not v_result.allowed or v_result.remaining <> 1 then
    raise exception 'First request was not admitted: %', row_to_json(v_result);
  end if;

  select * into v_result
  from public.consume_padron_lookup_rate_limit(v_user_id, 2, 60);

  if not v_result.allowed or v_result.remaining <> 0 then
    raise exception 'Second request was not admitted: %', row_to_json(v_result);
  end if;

  select * into v_result
  from public.consume_padron_lookup_rate_limit(v_user_id, 2, 60);

  if v_result.allowed or v_result.retry_after_seconds <= 0 then
    raise exception 'Third request was not rate limited: %', row_to_json(v_result);
  end if;

  if has_function_privilege('anon', 'public.consume_padron_lookup_rate_limit(uuid,integer,integer)', 'EXECUTE') then
    raise exception 'anon can execute consume_padron_lookup_rate_limit';
  end if;

  if has_function_privilege('authenticated', 'public.consume_padron_lookup_rate_limit(uuid,integer,integer)', 'EXECUTE') then
    raise exception 'authenticated can execute consume_padron_lookup_rate_limit';
  end if;

  if has_table_privilege('anon', 'public.arca_system_tickets', 'SELECT')
     or has_table_privilege('authenticated', 'public.arca_system_tickets', 'SELECT') then
    raise exception 'System ARCA tickets are readable from public client roles';
  end if;
end;
$$;

rollback;
