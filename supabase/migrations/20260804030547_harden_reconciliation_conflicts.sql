create or replace function public.reconcile_arca_voucher(
  p_punto_venta integer,
  p_tipo_comprobante text,
  p_cbte_tipo integer,
  p_cbte_nro integer,
  p_fecha date,
  p_total numeric,
  p_cae text,
  p_vencimiento_cae text,
  p_concepto text,
  p_doc_tipo integer,
  p_doc_nro bigint,
  p_arca_payload jsonb
)
returns public.comprobantes
language plpgsql
set search_path = ''
as $$
declare
  v_contribuyente public.contribuyentes%rowtype;
  v_environment text;
  v_comprobante public.comprobantes%rowtype;
  v_existing public.comprobantes%rowtype;
  v_legacy public.comprobantes%rowtype;
  v_formatted_number text;
  v_exact_ids uuid[];
  v_legacy_candidates integer;
begin
  select c.* into v_contribuyente
  from public.contribuyentes c
  where c.user_id = (select auth.uid())
  limit 1;

  if not found then
    raise exception 'Contribuyente inexistente';
  end if;

  v_environment := case
    when v_contribuyente.arca_production then 'produccion'
    else 'homologacion'
  end;
  v_formatted_number :=
    lpad(p_punto_venta::text, 4, '0') || '-' || lpad(p_cbte_nro::text, 8, '0');

  select c.* into v_existing
  from public.comprobantes c
  where c.contribuyente_id = v_contribuyente.id
    and c.arca_environment = v_environment
    and c.punto_venta = p_punto_venta
    and c.cbte_tipo = p_cbte_tipo
    and c.cbte_nro = p_cbte_nro
  for update;

  if found then
    if v_existing.tipo_comprobante is distinct from upper(p_tipo_comprobante)
        or v_existing.numero_comprobante is distinct from v_formatted_number
        or v_existing.fecha is distinct from p_fecha
        or v_existing.total is distinct from p_total
        or v_existing.cae is distinct from p_cae
        or (
          v_existing.cliente_doc_tipo is not null
          and v_existing.cliente_doc_tipo is distinct from p_doc_tipo
        )
        or (
          v_existing.cliente_doc_nro is not null
          and v_existing.cliente_doc_nro is distinct from p_doc_nro
        ) then
      raise exception 'Conflicto de comprobante existente: los datos fiscales no coinciden para %',
        v_formatted_number;
    end if;

    update public.comprobantes
    set
      vencimiento_cae = coalesce(vencimiento_cae, p_vencimiento_cae),
      concepto = coalesce(concepto, p_concepto),
      cliente_doc_tipo = coalesce(cliente_doc_tipo, p_doc_tipo),
      cliente_doc_nro = coalesce(cliente_doc_nro, p_doc_nro),
      reconciliado_at = now(),
      arca_payload = p_arca_payload,
      updated_at = now()
    where id = v_existing.id
    returning * into v_comprobante;

    return v_comprobante;
  end if;

  select array_agg(c.id order by c.id::text)
    into v_exact_ids
  from public.comprobantes c
  where c.contribuyente_id = v_contribuyente.id
    and c.cbte_nro is null
    and c.cbte_tipo is null
    and c.arca_environment is null
    and c.punto_venta = p_punto_venta
    and c.tipo_comprobante = upper(p_tipo_comprobante)
    and c.numero_comprobante = v_formatted_number
    and c.cae = p_cae
    and c.fecha = p_fecha
    and c.total = p_total
    and (c.cliente_doc_tipo is null or c.cliente_doc_tipo = p_doc_tipo)
    and (c.cliente_doc_nro is null or c.cliente_doc_nro = p_doc_nro);

  if coalesce(cardinality(v_exact_ids), 0) > 1 then
    raise exception 'Conflicto de comprobante historico: hay % coincidencias exactas para %',
      cardinality(v_exact_ids), v_formatted_number;
  end if;

  if coalesce(cardinality(v_exact_ids), 0) = 1 then
    select c.* into v_legacy
    from public.comprobantes c
    where c.id = v_exact_ids[1]
    for update;

    if v_legacy.cbte_nro is not null
        or v_legacy.cbte_tipo is not null
        or v_legacy.arca_environment is not null
        or v_legacy.punto_venta is distinct from p_punto_venta
        or v_legacy.tipo_comprobante is distinct from upper(p_tipo_comprobante)
        or v_legacy.numero_comprobante is distinct from v_formatted_number
        or v_legacy.cae is distinct from p_cae
        or v_legacy.fecha is distinct from p_fecha
        or v_legacy.total is distinct from p_total
        or (
          v_legacy.cliente_doc_tipo is not null
          and v_legacy.cliente_doc_tipo is distinct from p_doc_tipo
        )
        or (
          v_legacy.cliente_doc_nro is not null
          and v_legacy.cliente_doc_nro is distinct from p_doc_nro
        ) then
      raise exception 'Conflicto de comprobante historico: cambio concurrente para %',
        v_formatted_number;
    end if;

    update public.comprobantes
    set
      cbte_nro = p_cbte_nro,
      cbte_tipo = p_cbte_tipo,
      arca_environment = v_environment,
      vencimiento_cae = coalesce(vencimiento_cae, p_vencimiento_cae),
      concepto = coalesce(concepto, p_concepto),
      cliente_doc_tipo = coalesce(cliente_doc_tipo, p_doc_tipo),
      cliente_doc_nro = coalesce(cliente_doc_nro, p_doc_nro),
      reconciliado_at = now(),
      arca_payload = p_arca_payload,
      updated_at = now()
    where id = v_legacy.id
    returning * into v_comprobante;

    return v_comprobante;
  end if;

  select count(*) into v_legacy_candidates
  from public.comprobantes c
  where c.contribuyente_id = v_contribuyente.id
    and c.cbte_nro is null
    and c.punto_venta = p_punto_venta
    and c.tipo_comprobante = upper(p_tipo_comprobante)
    and c.numero_comprobante = v_formatted_number;

  if v_legacy_candidates > 0 then
    raise exception 'Conflicto de comprobante historico: los datos fiscales no coinciden para %',
      v_formatted_number;
  end if;

  insert into public.comprobantes (
    contribuyente_id, tipo_comprobante, numero_comprobante, punto_venta, fecha, total,
    cae, vencimiento_cae, estado, concepto, cliente_doc_tipo, cliente_doc_nro,
    cbte_nro, cbte_tipo, arca_environment, origen, reconciliado_at, arca_payload,
    created_at
  ) values (
    v_contribuyente.id, upper(p_tipo_comprobante), v_formatted_number,
    p_punto_venta, p_fecha, p_total, p_cae, p_vencimiento_cae, 'emitida', p_concepto,
    p_doc_tipo, p_doc_nro, p_cbte_nro, p_cbte_tipo, v_environment,
    'reconciliacion', now(), p_arca_payload,
    p_fecha::timestamp at time zone 'America/Argentina/Buenos_Aires'
  )
  on conflict (contribuyente_id, arca_environment, punto_venta, cbte_tipo, cbte_nro)
    where arca_environment is not null
      and punto_venta is not null
      and cbte_tipo is not null
      and cbte_nro is not null
  do nothing
  returning * into v_comprobante;

  if found then
    return v_comprobante;
  end if;

  select c.* into v_existing
  from public.comprobantes c
  where c.contribuyente_id = v_contribuyente.id
    and c.arca_environment = v_environment
    and c.punto_venta = p_punto_venta
    and c.cbte_tipo = p_cbte_tipo
    and c.cbte_nro = p_cbte_nro
  for update;

  if not found
      or v_existing.tipo_comprobante is distinct from upper(p_tipo_comprobante)
      or v_existing.numero_comprobante is distinct from v_formatted_number
      or v_existing.fecha is distinct from p_fecha
      or v_existing.total is distinct from p_total
      or v_existing.cae is distinct from p_cae
      or (
        v_existing.cliente_doc_tipo is not null
        and v_existing.cliente_doc_tipo is distinct from p_doc_tipo
      )
      or (
        v_existing.cliente_doc_nro is not null
        and v_existing.cliente_doc_nro is distinct from p_doc_nro
      ) then
    raise exception 'Conflicto de comprobante existente: colision concurrente para %',
      v_formatted_number;
  end if;

  update public.comprobantes
  set
    vencimiento_cae = coalesce(vencimiento_cae, p_vencimiento_cae),
    concepto = coalesce(concepto, p_concepto),
    cliente_doc_tipo = coalesce(cliente_doc_tipo, p_doc_tipo),
    cliente_doc_nro = coalesce(cliente_doc_nro, p_doc_nro),
    reconciliado_at = now(),
    arca_payload = p_arca_payload,
    updated_at = now()
  where id = v_existing.id
  returning * into v_comprobante;

  return v_comprobante;
end;
$$;

revoke all on function public.reconcile_arca_voucher(
  integer, text, integer, integer, date, numeric, text, text, text, integer, bigint, jsonb
) from public, anon;
grant execute on function public.reconcile_arca_voucher(
  integer, text, integer, integer, date, numeric, text, text, text, integer, bigint, jsonb
) to authenticated;
