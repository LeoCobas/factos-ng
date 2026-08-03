alter table public.comprobantes
  add column if not exists cbte_nro integer,
  add column if not exists cbte_tipo integer,
  add column if not exists arca_environment text,
  add column if not exists emision_id uuid,
  add column if not exists origen text not null default 'emision',
  add column if not exists reconciliado_at timestamptz,
  add column if not exists arca_payload jsonb;

alter table public.comprobantes
  add constraint comprobantes_arca_environment_check
    check (arca_environment is null or arca_environment in ('homologacion', 'produccion')),
  add constraint comprobantes_origen_check
    check (origen in ('emision', 'reconciliacion')),
  add constraint comprobantes_emision_id_unique unique (emision_id);

create unique index comprobantes_arca_identity_unique
  on public.comprobantes (
    contribuyente_id,
    arca_environment,
    punto_venta,
    cbte_tipo,
    cbte_nro
  )
  where arca_environment is not null
    and punto_venta is not null
    and cbte_tipo is not null
    and cbte_nro is not null;

create table public.arca_emisiones (
  id uuid primary key,
  contribuyente_id uuid not null references public.contribuyentes(id) on delete cascade,
  arca_environment text not null check (arca_environment in ('homologacion', 'produccion')),
  punto_venta integer not null check (punto_venta > 0),
  tipo_comprobante text not null,
  cbte_tipo integer not null check (cbte_tipo > 0),
  cbte_nro integer check (cbte_nro > 0),
  request_payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'persisted', 'rejected', 'uncertain', 'conflict')),
  arca_response jsonb,
  error_message text,
  authorized_at timestamptz,
  persisted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index arca_emisiones_owner_created_idx
  on public.arca_emisiones (contribuyente_id, created_at desc);
create index arca_emisiones_fiscal_idx
  on public.arca_emisiones (
    contribuyente_id,
    arca_environment,
    punto_venta,
    cbte_tipo,
    cbte_nro
  );

alter table public.arca_emisiones enable row level security;

create policy arca_emisiones_select_own
  on public.arca_emisiones for select
  using (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  );

create policy arca_emisiones_insert_own
  on public.arca_emisiones for insert
  with check (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  );

create policy arca_emisiones_update_own
  on public.arca_emisiones for update
  using (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  )
  with check (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  );

create or replace function public.finalize_arca_emission(
  p_emision_id uuid,
  p_cbte_nro integer,
  p_cae text,
  p_vencimiento_cae text,
  p_arca_payload jsonb,
  p_recovered boolean default false
)
returns public.comprobantes
language plpgsql
set search_path = ''
as $$
declare
  v_emision public.arca_emisiones%rowtype;
  v_comprobante public.comprobantes%rowtype;
  v_request jsonb;
begin
  select e.* into v_emision
  from public.arca_emisiones e
  join public.contribuyentes c on c.id = e.contribuyente_id
  where e.id = p_emision_id
    and c.user_id = (select auth.uid())
  for update of e;

  if not found then
    raise exception 'Emision inexistente o no autorizada';
  end if;

  v_request := v_emision.request_payload;

  insert into public.comprobantes (
    contribuyente_id,
    tipo_comprobante,
    numero_comprobante,
    punto_venta,
    fecha,
    total,
    cae,
    vencimiento_cae,
    estado,
    concepto,
    cliente_cuit,
    cliente_doc_tipo,
    cliente_doc_nro,
    cliente_nombre,
    cliente_domicilio,
    cliente_condicion_iva,
    cbte_nro,
    cbte_tipo,
    arca_environment,
    emision_id,
    origen,
    reconciliado_at,
    arca_payload
  ) values (
    v_emision.contribuyente_id,
    v_emision.tipo_comprobante,
    lpad(v_emision.punto_venta::text, 4, '0') || '-' || lpad(p_cbte_nro::text, 8, '0'),
    v_emision.punto_venta,
    (v_request->>'fecha')::date,
    (v_request->>'monto')::numeric,
    p_cae,
    p_vencimiento_cae,
    'emitida',
    nullif(v_request->>'concepto', ''),
    nullif(v_request->>'cliente_cuit', ''),
    (v_request->>'doc_tipo')::integer,
    (v_request->>'doc_nro')::bigint,
    nullif(v_request->>'cliente_nombre', ''),
    nullif(v_request->>'cliente_domicilio', ''),
    nullif(v_request->>'cliente_condicion_iva', ''),
    p_cbte_nro,
    v_emision.cbte_tipo,
    v_emision.arca_environment,
    v_emision.id,
    'emision',
    case when p_recovered then now() else null end,
    p_arca_payload
  )
  on conflict (emision_id) do update set
    cbte_nro = excluded.cbte_nro,
    numero_comprobante = excluded.numero_comprobante,
    cae = excluded.cae,
    vencimiento_cae = excluded.vencimiento_cae,
    arca_payload = excluded.arca_payload,
    reconciliado_at = coalesce(public.comprobantes.reconciliado_at, excluded.reconciliado_at),
    updated_at = now()
  returning * into v_comprobante;

  update public.arca_emisiones
  set cbte_nro = p_cbte_nro,
      status = 'persisted',
      arca_response = p_arca_payload,
      authorized_at = coalesce(authorized_at, now()),
      persisted_at = now(),
      error_message = null,
      updated_at = now()
  where id = p_emision_id;

  insert into public.ultimo_comprobante_cache (
    contribuyente_id, punto_venta, tipo_comprobante, cbte_tipo, ultimo_comprobante, synced_at
  ) values (
    v_emision.contribuyente_id, v_emision.punto_venta, v_emision.tipo_comprobante,
    v_emision.cbte_tipo, p_cbte_nro, now()
  )
  on conflict (contribuyente_id, punto_venta, tipo_comprobante) do update set
    cbte_tipo = excluded.cbte_tipo,
    ultimo_comprobante = greatest(public.ultimo_comprobante_cache.ultimo_comprobante, excluded.ultimo_comprobante),
    synced_at = now(),
    updated_at = now();

  return v_comprobante;
end;
$$;

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
begin
  select c.* into v_contribuyente
  from public.contribuyentes c
  where c.user_id = (select auth.uid())
  limit 1;

  if not found then
    raise exception 'Contribuyente inexistente';
  end if;

  v_environment := case when v_contribuyente.arca_production then 'produccion' else 'homologacion' end;

  insert into public.comprobantes (
    contribuyente_id, tipo_comprobante, numero_comprobante, punto_venta, fecha, total,
    cae, vencimiento_cae, estado, concepto, cliente_doc_tipo, cliente_doc_nro,
    cbte_nro, cbte_tipo, arca_environment, origen, reconciliado_at, arca_payload
  ) values (
    v_contribuyente.id, upper(p_tipo_comprobante),
    lpad(p_punto_venta::text, 4, '0') || '-' || lpad(p_cbte_nro::text, 8, '0'),
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

revoke all on function public.finalize_arca_emission(uuid, integer, text, text, jsonb, boolean) from public;
grant execute on function public.finalize_arca_emission(uuid, integer, text, text, jsonb, boolean) to authenticated;
revoke all on function public.reconcile_arca_voucher(integer, text, integer, integer, date, numeric, text, text, text, integer, bigint, jsonb) from public;
grant execute on function public.reconcile_arca_voucher(integer, text, integer, integer, date, numeric, text, text, text, integer, bigint, jsonb) to authenticated;
