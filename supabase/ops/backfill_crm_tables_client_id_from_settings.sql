-- SEO report tables sometimes stored the client only in integration_settings.clientId
-- while crm_tables.client_id stayed NULL — the client card lists by client_id.
UPDATE public.crm_tables t
SET client_id = (t.integration_settings->>'clientId')::uuid
WHERE t.client_id IS NULL
  AND t.integration_settings->>'clientId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
