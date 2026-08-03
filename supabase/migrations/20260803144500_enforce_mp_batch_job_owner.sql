do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contribuyentes_id_user_id_key'
      and conrelid = 'public.contribuyentes'::regclass
  ) then
    alter table public.contribuyentes
      add constraint contribuyentes_id_user_id_key unique (id, user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'mp_batch_jobs_contribuyente_user_fkey'
      and conrelid = 'public.mp_batch_jobs'::regclass
  ) then
    alter table public.mp_batch_jobs
      add constraint mp_batch_jobs_contribuyente_user_fkey
      foreign key (contribuyente_id, user_id)
      references public.contribuyentes(id, user_id)
      on delete cascade;
  end if;
end;
$$;
