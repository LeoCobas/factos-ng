alter table public.mp_batch_jobs
  add column if not exists user_id uuid;

update public.mp_batch_jobs as job
set user_id = contribuyente.user_id
from public.contribuyentes as contribuyente
where contribuyente.id = job.contribuyente_id
  and job.user_id is null;

alter table public.mp_batch_jobs
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mp_batch_jobs_user_id_fkey'
      and conrelid = 'public.mp_batch_jobs'::regclass
  ) then
    alter table public.mp_batch_jobs
      add constraint mp_batch_jobs_user_id_fkey
      foreign key (user_id) references auth.users(id);
  end if;
end;
$$;
