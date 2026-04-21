ALTER TABLE public.contribuyentes
  ADD COLUMN IF NOT EXISTS nombre_fantasia text,
  ADD COLUMN IF NOT EXISTS domicilio text,
  ADD COLUMN IF NOT EXISTS ingresos_brutos text,
  ADD COLUMN IF NOT EXISTS inicio_actividades date,
  ADD COLUMN IF NOT EXISTS condicion_iva text DEFAULT 'Responsable Monotributo';;
