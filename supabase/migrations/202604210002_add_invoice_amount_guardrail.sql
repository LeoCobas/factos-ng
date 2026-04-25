alter table public.contribuyentes
  add column if not exists monto_maximo_factura numeric default 0;

update public.contribuyentes
set monto_maximo_factura = 0
where monto_maximo_factura is null;

alter table public.contribuyentes
  alter column monto_maximo_factura set default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contribuyentes_monto_maximo_factura_nonnegative'
      and conrelid = 'public.contribuyentes'::regclass
  ) then
    alter table public.contribuyentes
      add constraint contribuyentes_monto_maximo_factura_nonnegative
      check (monto_maximo_factura >= 0);
  end if;
end $$;

comment on column public.contribuyentes.monto_maximo_factura is
  'Monto maximo sugerido para facturas. 0 desactiva el limite y evita pedir confirmacion extra.';
