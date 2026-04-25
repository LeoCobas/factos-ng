create table public.ultimo_comprobante_cache (
  id uuid primary key default gen_random_uuid(),
  contribuyente_id uuid not null references public.contribuyentes(id) on delete cascade,
  punto_venta integer not null check (punto_venta > 0),
  tipo_comprobante text not null,
  cbte_tipo integer not null check (cbte_tipo > 0),
  ultimo_comprobante integer not null check (ultimo_comprobante >= 0),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contribuyente_id, punto_venta, tipo_comprobante)
);

create index idx_ultimo_comprobante_cache_fresh
  on public.ultimo_comprobante_cache (contribuyente_id, punto_venta, tipo_comprobante, synced_at desc);

create trigger set_updated_at_ultimo_comprobante_cache
  before update on public.ultimo_comprobante_cache
  for each row execute function public.update_updated_at_column();

alter table public.ultimo_comprobante_cache enable row level security;

create policy "ultimo_comprobante_cache_select_own"
  on public.ultimo_comprobante_cache
  for select
  using (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  );

create policy "ultimo_comprobante_cache_insert_own"
  on public.ultimo_comprobante_cache
  for insert
  with check (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  );

create policy "ultimo_comprobante_cache_update_own"
  on public.ultimo_comprobante_cache
  for update
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
