begin;

do $$
declare
  v_user_id uuid;
  v_contribuyente_id uuid;
  v_legacy_id uuid := gen_random_uuid();
  v_result public.comprobantes%rowtype;
  v_count integer;
  v_punto_venta integer := 9876;
  v_fecha date := date '2026-01-02';
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

  insert into public.comprobantes (
    id, contribuyente_id, tipo_comprobante, numero_comprobante, punto_venta,
    fecha, total, cae, vencimiento_cae, estado, concepto, cliente_nombre, origen
  ) values (
    v_legacy_id, v_contribuyente_id, 'FACTURA C', '9876-00000042', v_punto_venta,
    v_fecha, 123.45, '12345678901234', '20260814', 'emitida', 'Servicios',
    'Dato local preservado', 'emision'
  );

  select * into v_result
  from public.reconcile_arca_voucher(
    v_punto_venta, 'FACTURA C', 11, 42, v_fecha, 123.45,
    '12345678901234', '20260814', 'Servicios', 99, 0,
    '{"source":"arca"}'::jsonb
  );

  if v_result.id <> v_legacy_id then
    raise exception 'Reconciliation duplicated the legacy voucher instead of enriching it';
  end if;
  if v_result.cbte_nro <> 42 or v_result.cbte_tipo <> 11
      or v_result.arca_environment is null or v_result.reconciliado_at is null then
    raise exception 'Legacy voucher did not receive fiscal identity: %', row_to_json(v_result);
  end if;
  if v_result.cliente_nombre <> 'Dato local preservado' or v_result.origen <> 'emision' then
    raise exception 'Reconciliation overwrote local data: %', row_to_json(v_result);
  end if;

  select count(*) into v_count
  from public.comprobantes
  where contribuyente_id = v_contribuyente_id
    and numero_comprobante = '9876-00000042';
  if v_count <> 1 then
    raise exception 'Expected one logical voucher after reconciliation, found %', v_count;
  end if;

  insert into public.comprobantes (
    contribuyente_id, tipo_comprobante, numero_comprobante, punto_venta,
    fecha, total, cae, estado, origen
  ) values (
    v_contribuyente_id, 'FACTURA C', '9876-00000043', v_punto_venta,
    v_fecha, 500, '99999999999999', 'emitida', 'emision'
  );

  begin
    perform public.reconcile_arca_voucher(
      v_punto_venta, 'FACTURA C', 11, 43, v_fecha, 700,
      '88888888888888', '20260814', 'Servicios', 99, 0, '{}'::jsonb
    );
    raise exception 'Conflicting legacy voucher was accepted';
  exception
    when others then
      if sqlerrm = 'Conflicting legacy voucher was accepted' then
        raise;
      end if;
      if sqlerrm not like 'Conflicto de comprobante historico:%' then
        raise;
      end if;
  end;

  select * into v_result
  from public.reconcile_arca_voucher(
    v_punto_venta, 'FACTURA C', 11, 44, v_fecha, 900,
    '77777777777777', '20260814', 'Servicios', 99, 0, '{}'::jsonb
  );
  if v_result.cbte_nro <> 44 or v_result.origen <> 'reconciliacion' then
    raise exception 'Missing ARCA voucher was not imported: %', row_to_json(v_result);
  end if;
  if (v_result.created_at at time zone 'America/Argentina/Buenos_Aires')::date <> v_fecha then
    raise exception 'Imported voucher did not preserve its fiscal date: %', row_to_json(v_result);
  end if;

  begin
    perform public.reconcile_arca_voucher(
      v_punto_venta, 'FACTURA C', 11, 44, v_fecha, 901,
      '77777777777777', '20260814', 'Servicios', 99, 0, '{}'::jsonb
    );
    raise exception 'Existing fiscal identity mismatch was accepted';
  exception
    when others then
      if sqlerrm = 'Existing fiscal identity mismatch was accepted' then
        raise;
      end if;
      if sqlerrm not like 'Conflicto de comprobante existente:%' then
        raise;
      end if;
  end;

  insert into public.comprobantes (
    contribuyente_id, tipo_comprobante, numero_comprobante, punto_venta,
    fecha, total, cae, estado, origen
  ) values (
    v_contribuyente_id, 'FACTURA C', '9876-00000045', v_punto_venta,
    v_fecha, 100, '66666666666666', 'emitida', 'emision'
  );

  begin
    perform public.reconcile_arca_voucher(
      v_punto_venta, 'FACTURA C', 11, 45, v_fecha, 100.01,
      '66666666666666', '20260814', 'Servicios', 99, 0, '{}'::jsonb
    );
    raise exception 'One-cent legacy mismatch was accepted';
  exception
    when others then
      if sqlerrm = 'One-cent legacy mismatch was accepted' then
        raise;
      end if;
      if sqlerrm not like 'Conflicto de comprobante historico:%' then
        raise;
      end if;
  end;
end;
$$;

rollback;
