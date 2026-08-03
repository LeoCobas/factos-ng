create or replace function public.prepare_arca_emission(
  p_emision_id uuid,
  p_punto_venta integer,
  p_tipo_comprobante text,
  p_cbte_tipo integer,
  p_request_payload jsonb,
  p_cache_cutoff timestamptz
)
returns table (
  contribuyente_id uuid,
  cuit text,
  arca_cert text,
  arca_key text,
  arca_production boolean,
  arca_ticket jsonb,
  ultimo_comprobante integer,
  cache_synced_at timestamptz,
  attempt jsonb,
  attempt_existing boolean,
  comprobante jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contribuyente public.contribuyentes%rowtype;
  v_cache public.ultimo_comprobante_cache%rowtype;
  v_emision public.arca_emisiones%rowtype;
  v_comprobante public.comprobantes%rowtype;
  v_environment text;
  v_inserted boolean := false;
  v_fiscal_keys text[] := array[
    'fecha',
    'monto',
    'doc_tipo',
    'doc_nro',
    'concepto_afip',
    'iva_porcentaje',
    'condicion_iva_receptor_id'
  ];
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'No autorizado';
  end if;

  if p_emision_id is null then
    raise exception using errcode = '22023', message = 'emision_id es requerido';
  end if;
  if p_punto_venta is null or p_punto_venta <= 0 then
    raise exception using errcode = '22023', message = 'punto_venta invalido';
  end if;
  if nullif(trim(p_tipo_comprobante), '') is null or p_cbte_tipo is null or p_cbte_tipo <= 0 then
    raise exception using errcode = '22023', message = 'tipo de comprobante invalido';
  end if;
  if p_request_payload is null or jsonb_typeof(p_request_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'request_payload invalido';
  end if;

  select c.*
    into v_contribuyente
  from public.contribuyentes c
  where c.user_id = (select auth.uid())
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'No se encontro el contribuyente';
  end if;

  v_environment := case
    when v_contribuyente.arca_production is true then 'produccion'
    else 'homologacion'
  end;

  select uc.*
    into v_cache
  from public.ultimo_comprobante_cache uc
  where uc.contribuyente_id = v_contribuyente.id
    and uc.punto_venta = p_punto_venta
    and uc.tipo_comprobante = p_tipo_comprobante
    and uc.cbte_tipo = p_cbte_tipo
    and uc.synced_at >= p_cache_cutoff
  order by uc.synced_at desc
  limit 1;

  insert into public.arca_emisiones (
    id,
    contribuyente_id,
    arca_environment,
    punto_venta,
    tipo_comprobante,
    cbte_tipo,
    cbte_nro,
    request_payload,
    status
  ) values (
    p_emision_id,
    v_contribuyente.id,
    v_environment,
    p_punto_venta,
    p_tipo_comprobante,
    p_cbte_tipo,
    case when v_cache.id is not null then v_cache.ultimo_comprobante + 1 else null end,
    p_request_payload,
    'pending'
  )
  on conflict (id) do nothing
  returning * into v_emision;

  v_inserted := found;

  if not v_inserted then
    select e.*
      into v_emision
    from public.arca_emisiones e
    where e.id = p_emision_id
    for update;

    if not found then
      raise exception using
        errcode = '42501',
        message = 'El identificador de emision pertenece a otro contribuyente o no es accesible';
    end if;
  end if;

  if v_emision.contribuyente_id <> v_contribuyente.id
    or v_emision.arca_environment <> v_environment
    or v_emision.punto_venta <> p_punto_venta
    or v_emision.tipo_comprobante <> p_tipo_comprobante
    or v_emision.cbte_tipo <> p_cbte_tipo
    or (
      select jsonb_object_agg(fiscal_key, v_emision.request_payload -> fiscal_key)
      from unnest(v_fiscal_keys) as fiscal_keys(fiscal_key)
    )
       is distinct from
       (
         select jsonb_object_agg(fiscal_key, p_request_payload -> fiscal_key)
         from unnest(v_fiscal_keys) as fiscal_keys(fiscal_key)
       )
  then
    raise exception using
      errcode = '22023',
      message = 'El identificador de emision fue reutilizado con un payload fiscal diferente';
  end if;

  if v_emision.status = 'persisted' then
    select c.*
      into v_comprobante
    from public.comprobantes c
    where c.emision_id = p_emision_id
    limit 1;
  end if;

  return query
  select
    v_contribuyente.id,
    v_contribuyente.cuit,
    v_contribuyente.arca_cert,
    v_contribuyente.arca_key,
    v_contribuyente.arca_production,
    v_contribuyente.arca_ticket,
    case when v_cache.id is not null then v_cache.ultimo_comprobante else null end,
    case when v_cache.id is not null then v_cache.synced_at else null end,
    to_jsonb(v_emision),
    not v_inserted,
    case when v_comprobante.id is not null then to_jsonb(v_comprobante) else null end;
end;
$$;

revoke all on function public.prepare_arca_emission(
  uuid, integer, text, integer, jsonb, timestamptz
) from public;

revoke all on function public.prepare_arca_emission(
  uuid, integer, text, integer, jsonb, timestamptz
) from anon;

grant execute on function public.prepare_arca_emission(
  uuid, integer, text, integer, jsonb, timestamptz
) to authenticated;
