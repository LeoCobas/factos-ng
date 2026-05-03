-- Ajusta los indices de comprobantes al uso real de la app:
-- - listado general por contribuyente ordenado por created_at desc
-- - listado/resumen por contribuyente + fecha
-- - metricas por contribuyente ordenadas por fecha desc

create index if not exists idx_comprobantes_contribuyente_created_at_desc
  on public.comprobantes (contribuyente_id, created_at desc);

create index if not exists idx_comprobantes_contribuyente_fecha_created_at_desc
  on public.comprobantes (contribuyente_id, fecha desc, created_at desc);

drop index if exists public.idx_comprobantes_contribuyente_fecha;
drop index if exists public.idx_comprobantes_contribuyente_id;
drop index if exists public.idx_comprobantes_fecha;
