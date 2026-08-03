begin;

do $$
declare
  v_user_id uuid;
  v_contribuyente_id uuid;
  v_emision_id uuid := gen_random_uuid();
  v_punto_venta integer := 98764;
  v_payload jsonb := jsonb_build_object(
    'fecha', current_date::text,
    'monto', 321.09,
    'doc_tipo', 99,
    'doc_nro', 0,
    'concepto', 'Productos',
    'concepto_afip', 1,
    'iva_porcentaje', 0,
    'condicion_iva_receptor_id', 5
  );
  v_result record;
  v_timings jsonb;
begin
  select c.user_id, c.id
    into v_user_id, v_contribuyente_id
  from public.contribuyentes c
  order by c.created_at
  limit 1;

  if v_user_id is null then
    raise exception 'Test requires one contribuyente fixture';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  select * into v_result
  from public.prepare_arca_emission(
    v_emision_id,
    v_punto_venta,
    'FACTURA C',
    11,
    v_payload,
    now()
  );

  perform public.finalize_arca_emission(
    v_emision_id,
    1,
    'TEST-CAE',
    to_char(current_date + 10, 'YYYYMMDD'),
    '{}'::jsonb,
    false,
    '{"emission_prepare_db":175.2}'::jsonb
  );

  select request_timings into v_timings
  from public.arca_emisiones
  where id = v_emision_id;

  if (v_timings->>'durable_persist_db')::numeric < 0 then
    raise exception 'Database persistence timing is invalid: %', v_timings;
  end if;

  perform public.record_arca_emission_timings(
    v_emision_id,
    '{"durable_persist":418.4,"total":901.7}'::jsonb
  );

  select request_timings into v_timings
  from public.arca_emisiones
  where id = v_emision_id;

  if v_timings->>'emission_prepare_db' <> '175.2'
    or v_timings->>'durable_persist' <> '418.4'
    or v_timings->>'total' <> '901.7'
    or v_timings->>'durable_persist_db' is null then
    raise exception 'Persistence timings were not merged: %', v_timings;
  end if;

  reset role;
  set local role anon;
  begin
    perform public.record_arca_emission_timings(v_emision_id, '{}'::jsonb);
    raise exception 'anon could record emission timings';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;
