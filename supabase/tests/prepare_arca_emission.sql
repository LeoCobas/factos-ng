begin;

do $$
declare
  v_user_id uuid;
  v_contribuyente_id uuid;
  v_emision_fresh uuid := gen_random_uuid();
  v_emision_stale uuid := gen_random_uuid();
  v_result record;
  v_punto_venta integer := 98765;
  v_payload jsonb := jsonb_build_object(
    'fecha', current_date::text,
    'monto', 123.45,
    'doc_tipo', 99,
    'doc_nro', 0,
    'concepto_afip', 2,
    'iva_porcentaje', 21,
    'condicion_iva_receptor_id', 5
  );
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

  insert into public.ultimo_comprobante_cache (
    contribuyente_id, punto_venta, tipo_comprobante, cbte_tipo, ultimo_comprobante, synced_at
  ) values (
    v_contribuyente_id, v_punto_venta, 'FACTURA C', 11, 123, now()
  );

  select * into v_result
  from public.prepare_arca_emission(
    v_emision_fresh,
    v_punto_venta,
    'FACTURA C',
    11,
    v_payload,
    now() - interval '15 minutes'
  );

  if v_result.attempt_existing or (v_result.attempt->>'cbte_nro')::integer <> 124 then
    raise exception 'Fresh cache did not create one new attempt with number 124: %', row_to_json(v_result);
  end if;

  select * into v_result
  from public.prepare_arca_emission(
    v_emision_fresh,
    v_punto_venta,
    'FACTURA C',
    11,
    v_payload,
    now() - interval '15 minutes'
  );

  if not v_result.attempt_existing or (v_result.attempt->>'id')::uuid <> v_emision_fresh then
    raise exception 'Idempotent resend did not return the existing attempt';
  end if;

  begin
    perform public.prepare_arca_emission(
      v_emision_fresh,
      v_punto_venta,
      'FACTURA C',
      11,
      v_payload || '{"monto":999.99}'::jsonb,
      now() - interval '15 minutes'
    );
    raise exception 'Different fiscal payload was accepted';
  exception
    when others then
      if sqlerrm = 'Different fiscal payload was accepted' then
        raise;
      end if;
      if sqlerrm not like '%payload fiscal diferente%' then
        raise;
      end if;
  end;

  update public.ultimo_comprobante_cache
  set synced_at = now() - interval '16 minutes'
  where contribuyente_id = v_contribuyente_id
    and punto_venta = v_punto_venta
    and tipo_comprobante = 'FACTURA C';

  select * into v_result
  from public.prepare_arca_emission(
    v_emision_stale,
    v_punto_venta,
    'FACTURA C',
    11,
    v_payload,
    now() - interval '15 minutes'
  );

  if v_result.attempt->>'cbte_nro' is not null then
    raise exception 'Stale cache assigned a voucher number: %', v_result.attempt;
  end if;

  insert into public.comprobantes (
    contribuyente_id, tipo_comprobante, numero_comprobante, punto_venta, fecha, total,
    estado, cbte_nro, cbte_tipo, arca_environment, emision_id, origen
  ) values (
    v_contribuyente_id, 'FACTURA C', '98765-00000124', v_punto_venta, current_date, 123.45,
    'emitida', 124, 11, 'homologacion', v_emision_fresh, 'emision'
  );
  update public.arca_emisiones set status = 'persisted' where id = v_emision_fresh;

  select * into v_result
  from public.prepare_arca_emission(
    v_emision_fresh,
    v_punto_venta,
    'FACTURA C',
    11,
    v_payload,
    now() - interval '15 minutes'
  );

  if v_result.comprobante->>'emision_id' <> v_emision_fresh::text then
    raise exception 'Persisted attempt did not return its comprobante';
  end if;

  reset role;
  set local role anon;
  begin
    perform public.prepare_arca_emission(
      gen_random_uuid(), v_punto_venta, 'FACTURA C', 11, v_payload, now()
    );
    raise exception 'anon could execute prepare_arca_emission';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;
