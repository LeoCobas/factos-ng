-- Tabla para cachear tickets de autenticación WSAA (válidos ~12hs)
-- Solo la Edge Function accede via service_role, no necesita RLS
CREATE TABLE wsaa_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuit TEXT NOT NULL,
  service_name TEXT NOT NULL, -- 'wsfe', 'ws_sr_padron_a4', etc.
  credentials JSONB NOT NULL, -- { header: {...}, credentials: {...} }
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cuit, service_name)
);;
