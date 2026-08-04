create table public.padron_lookup_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.padron_lookup_rate_limits enable row level security;

revoke all on table public.padron_lookup_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.padron_lookup_rate_limits to service_role;

create table public.arca_system_tickets (
  service_name text not null,
  cuit bigint not null check (cuit > 0),
  production boolean not null,
  ticket jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (service_name, cuit, production)
);

alter table public.arca_system_tickets enable row level security;

revoke all on table public.arca_system_tickets from public, anon, authenticated;
grant select, insert, update, delete on table public.arca_system_tickets to service_role;

create or replace function public.consume_padron_lookup_rate_limit(
  p_user_id uuid,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_limit public.padron_lookup_rate_limits%rowtype;
begin
  if p_user_id is null then
    raise exception 'User ID is required';
  end if;

  if p_max_requests < 1 or p_max_requests > 100 then
    raise exception 'Invalid maximum request count';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'Invalid rate limit window';
  end if;

  insert into public.padron_lookup_rate_limits as limits (
    user_id,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_user_id,
    v_now,
    1,
    v_now
  )
  on conflict (user_id) do update
  set
    window_started_at = case
      when limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then v_now
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then 1
      else limits.request_count + 1
    end,
    updated_at = v_now
  returning * into v_limit;

  allowed := v_limit.request_count <= p_max_requests;
  remaining := greatest(p_max_requests - v_limit.request_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      ceil(extract(epoch from (
        v_limit.window_started_at + make_interval(secs => p_window_seconds) - v_now
      )))::integer,
      1
    )
  end;

  return next;
end;
$$;

revoke all on function public.consume_padron_lookup_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_padron_lookup_rate_limit(uuid, integer, integer)
  to service_role;
