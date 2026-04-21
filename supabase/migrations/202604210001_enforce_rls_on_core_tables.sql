alter table public.contribuyentes enable row level security;
alter table public.comprobantes enable row level security;

drop policy if exists "contribuyentes_select_own" on public.contribuyentes;
create policy "contribuyentes_select_own"
  on public.contribuyentes
  for select
  using (user_id = (select auth.uid()));

drop policy if exists "contribuyentes_insert_own" on public.contribuyentes;
create policy "contribuyentes_insert_own"
  on public.contribuyentes
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "contribuyentes_update_own" on public.contribuyentes;
create policy "contribuyentes_update_own"
  on public.contribuyentes
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "contribuyentes_delete_own" on public.contribuyentes;
create policy "contribuyentes_delete_own"
  on public.contribuyentes
  for delete
  using (user_id = (select auth.uid()));

drop policy if exists "comprobantes_select_own" on public.comprobantes;
create policy "comprobantes_select_own"
  on public.comprobantes
  for select
  using (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  );

drop policy if exists "comprobantes_insert_own" on public.comprobantes;
create policy "comprobantes_insert_own"
  on public.comprobantes
  for insert
  with check (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  );

drop policy if exists "comprobantes_update_own" on public.comprobantes;
create policy "comprobantes_update_own"
  on public.comprobantes
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

drop policy if exists "comprobantes_delete_own" on public.comprobantes;
create policy "comprobantes_delete_own"
  on public.comprobantes
  for delete
  using (
    contribuyente_id in (
      select id from public.contribuyentes where user_id = (select auth.uid())
    )
  );
