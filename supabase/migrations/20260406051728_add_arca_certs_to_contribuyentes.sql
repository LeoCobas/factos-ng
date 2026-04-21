-- Agregar columnas para almacenar certificados ARCA por contribuyente (multi-tenant)
ALTER TABLE contribuyentes ADD COLUMN IF NOT EXISTS arca_cert TEXT;
ALTER TABLE contribuyentes ADD COLUMN IF NOT EXISTS arca_key TEXT;
ALTER TABLE contribuyentes ADD COLUMN IF NOT EXISTS arca_production BOOLEAN DEFAULT false;

COMMENT ON COLUMN contribuyentes.arca_cert IS 'Contenido del certificado .crt de ARCA/AFIP (PEM)';
COMMENT ON COLUMN contribuyentes.arca_key IS 'Contenido de la clave privada .key de ARCA/AFIP (PEM)';
COMMENT ON COLUMN contribuyentes.arca_production IS 'true=producción, false=homologación/testing';;
