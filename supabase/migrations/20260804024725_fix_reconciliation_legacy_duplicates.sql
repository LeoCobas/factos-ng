create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.reconciliation_duplicate_backup_20260804 (
  legacy_id uuid primary key,
  imported_id uuid unique not null,
  legacy_row jsonb not null,
  imported_row jsonb not null,
  backed_up_at timestamptz not null default now()
);

revoke all on table private.reconciliation_duplicate_backup_20260804
  from public, anon, authenticated;

comment on table private.reconciliation_duplicate_backup_20260804 is
  'Backup previo a fusionar duplicados exactos creados por la auditoria ARCA del 2026-08-04.';

create temporary table reconciliation_pairs_20260804
on commit drop
as
with candidates as (
  select
    legacy.id as legacy_id,
    imported.id as imported_id,
    to_jsonb(legacy) as legacy_row,
    to_jsonb(imported) as imported_row,
    count(*) over (partition by legacy.id) as matches_for_legacy,
    count(*) over (partition by imported.id) as matches_for_imported
  from public.comprobantes legacy
  join public.comprobantes imported
    on imported.contribuyente_id = legacy.contribuyente_id
   and imported.numero_comprobante = legacy.numero_comprobante
   and imported.punto_venta = legacy.punto_venta
   and imported.tipo_comprobante = legacy.tipo_comprobante
   and imported.cae = legacy.cae
   and imported.fecha = legacy.fecha
   and imported.total = legacy.total
   and imported.origen = 'reconciliacion'
   and imported.cbte_nro is not null
   and imported.cbte_tipo is not null
   and imported.arca_environment is not null
  where legacy.cbte_nro is null
    and legacy.cbte_tipo is null
    and legacy.arca_environment is null
    and legacy.id <> imported.id
)
select legacy_id, imported_id, legacy_row, imported_row
from candidates
where matches_for_legacy = 1
  and matches_for_imported = 1;

do $$
declare
  v_total integer;
  v_adrian integer;
  v_leo integer;
  v_paula integer;
begin
  select
    count(*),
    count(*) filter (where (legacy_row->>'contribuyente_id')::uuid = '30ca9bed-6951-4e47-8a2c-c2f2577ad275'),
    count(*) filter (where (legacy_row->>'contribuyente_id')::uuid = '23bcd008-256e-4637-b453-d7f7a271fa83'),
    count(*) filter (where (legacy_row->>'contribuyente_id')::uuid = 'debaa3d1-903f-4dfe-9d3a-ac8fa6751bc3')
    into v_total, v_adrian, v_leo, v_paula
  from reconciliation_pairs_20260804;

  if v_total <> 0 and (
    v_total <> 183 or v_adrian <> 76 or v_leo <> 7 or v_paula <> 100
  ) then
    raise exception
      'Reparacion ARCA fuera del alcance auditado: total %, Adrian %, Leo %, Paula %',
      v_total, v_adrian, v_leo, v_paula;
  end if;
end;
$$;

insert into private.reconciliation_duplicate_backup_20260804 (
  legacy_id,
  imported_id,
  legacy_row,
  imported_row
)
select legacy_id, imported_id, legacy_row, imported_row
from reconciliation_pairs_20260804
on conflict (legacy_id) do nothing;

delete from public.comprobantes imported
using reconciliation_pairs_20260804 repair
where imported.id = repair.imported_id;

update public.comprobantes legacy
set
  cbte_nro = (repair.imported_row->>'cbte_nro')::integer,
  cbte_tipo = (repair.imported_row->>'cbte_tipo')::integer,
  arca_environment = repair.imported_row->>'arca_environment',
  vencimiento_cae = coalesce(legacy.vencimiento_cae, repair.imported_row->>'vencimiento_cae'),
  concepto = coalesce(legacy.concepto, repair.imported_row->>'concepto'),
  cliente_doc_tipo = coalesce(
    legacy.cliente_doc_tipo,
    nullif(repair.imported_row->>'cliente_doc_tipo', '')::integer
  ),
  cliente_doc_nro = coalesce(
    legacy.cliente_doc_nro,
    nullif(repair.imported_row->>'cliente_doc_nro', '')::bigint
  ),
  reconciliado_at = coalesce(
    legacy.reconciliado_at,
    (repair.imported_row->>'reconciliado_at')::timestamptz,
    now()
  ),
  arca_payload = coalesce(
    nullif(repair.imported_row->'arca_payload', 'null'::jsonb),
    legacy.arca_payload
  ),
  updated_at = now()
from reconciliation_pairs_20260804 repair
where legacy.id = repair.legacy_id;

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
    and c.total = p_total;

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
    cbte_nro, cbte_tipo, arca_environment, origen, reconciliado_at, arca_payload
  ) values (
    v_contribuyente.id, upper(p_tipo_comprobante), v_formatted_number,
    p_punto_venta, p_fecha, p_total, p_cae, p_vencimiento_cae, 'emitida', p_concepto,
    p_doc_tipo, p_doc_nro, p_cbte_nro, p_cbte_tipo, v_environment,
    'reconciliacion', now(), p_arca_payload
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
