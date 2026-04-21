-- Eliminar columnas de TusFacturas API (ya no necesarias con Arca SDK)
ALTER TABLE contribuyentes DROP COLUMN IF EXISTS api_token;
ALTER TABLE contribuyentes DROP COLUMN IF EXISTS api_key;
ALTER TABLE contribuyentes DROP COLUMN IF EXISTS user_token;

-- Actualizar comentario de la tabla
COMMENT ON TABLE contribuyentes IS 'Datos del contribuyente. Facturación electrónica via Arca SDK (AFIP directo).';;
