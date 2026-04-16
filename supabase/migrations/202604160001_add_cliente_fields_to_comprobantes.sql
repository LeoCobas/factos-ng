alter table public.comprobantes
  add column if not exists cliente_cuit text,
  add column if not exists cliente_doc_tipo integer,
  add column if not exists cliente_doc_nro bigint,
  add column if not exists cliente_nombre text,
  add column if not exists cliente_domicilio text,
  add column if not exists cliente_condicion_iva text;
