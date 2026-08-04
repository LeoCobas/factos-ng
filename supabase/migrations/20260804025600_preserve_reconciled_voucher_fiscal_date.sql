update public.comprobantes
set created_at = fecha::timestamp at time zone 'America/Argentina/Buenos_Aires'
where origen = 'reconciliacion'
  and reconciliado_at is not null
  and fecha is not null;

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
  v_formatted_number text;
  v_legacy_id uuid;
  v_legacy_candidates integer;
  v_exact_matches integer;
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

  select count(*), min(c.id::text)::uuid
    into v_exact_matches, v_legacy_id
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
    and abs(c.total - p_total) <= 0.01;

  if v_exact_matches > 1 then
    raise exception 'Conflicto de comprobante historico: hay % coincidencias exactas para %',
      v_exact_matches, v_formatted_number;
  end if;

  if v_exact_matches = 1 then
    select c.id into v_legacy_id
    from public.comprobantes c
    where c.id = v_legacy_id
    for update;

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
    where id = v_legacy_id
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
  do update set
    tipo_comprobante = excluded.tipo_comprobante,
    numero_comprobante = excluded.numero_comprobante,
    fecha = excluded.fecha,
    total = excluded.total,
    cae = excluded.cae,
    vencimiento_cae = excluded.vencimiento_cae,
    concepto = coalesce(public.comprobantes.concepto, excluded.concepto),
    cliente_doc_tipo = coalesce(public.comprobantes.cliente_doc_tipo, excluded.cliente_doc_tipo),
    cliente_doc_nro = coalesce(public.comprobantes.cliente_doc_nro, excluded.cliente_doc_nro),
    reconciliado_at = now(),
    arca_payload = excluded.arca_payload,
    updated_at = now()
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
