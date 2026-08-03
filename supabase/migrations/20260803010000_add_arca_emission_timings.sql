alter table public.arca_emisiones
  add column if not exists request_timings jsonb;

drop function if exists public.finalize_arca_emission(
  uuid, integer, text, text, jsonb, boolean
);

create function public.finalize_arca_emission(
  p_emision_id uuid,
  p_cbte_nro integer,
  p_cae text,
  p_vencimiento_cae text,
  p_arca_payload jsonb,
  p_recovered boolean default false,
  p_request_timings jsonb default null
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
      request_timings = coalesce(p_request_timings, request_timings),
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
    ultimo_comprobante = greatest(
      public.ultimo_comprobante_cache.ultimo_comprobante,
      excluded.ultimo_comprobante
    ),
    synced_at = now(),
    updated_at = now();

  return v_comprobante;
end;
$$;

revoke all on function public.finalize_arca_emission(
  uuid, integer, text, text, jsonb, boolean, jsonb
) from public;

revoke all on function public.finalize_arca_emission(
  uuid, integer, text, text, jsonb, boolean, jsonb
) from anon;

grant execute on function public.finalize_arca_emission(
  uuid, integer, text, text, jsonb, boolean, jsonb
) to authenticated;
