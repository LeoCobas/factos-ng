-- Enable RLS on wsaa_tickets but deny all access from public API
-- Only Edge Functions with service_role can access this table
ALTER TABLE wsaa_tickets ENABLE ROW LEVEL SECURITY;

-- No policies = no access from anon/authenticated roles
-- Edge Functions use service_role key which bypasses RLS;
