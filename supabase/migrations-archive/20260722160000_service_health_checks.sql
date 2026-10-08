-- Uptime/latency history for the Carmen Command Center heartbeat panel.
-- Written by the carmen-health-probe edge function (service role only).
-- Global services (db, mcp_*, openai) have tenant_id NULL; per-tenant
-- services (whatsapp) carry the tenant_id.

CREATE TABLE IF NOT EXISTS public.service_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  service text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'warn', 'down')),
  latency_ms integer,
  detail text,
  checked_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_health_checks_service_time
  ON public.service_health_checks (service, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_health_checks_tenant
  ON public.service_health_checks (tenant_id, checked_at DESC);

ALTER TABLE public.service_health_checks ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user sees global rows + rows of tenants they belong to.
-- Write: service role only (no insert/update/delete policies).
CREATE POLICY "service_health_checks_read"
  ON public.service_health_checks FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- Scheduling (applied to prod pg_cron out-of-repo, same as other cron functions;
-- documented here for re-application on a fresh project — replace <ANON_KEY>):
--   SELECT cron.schedule(
--     'carmen-health-probe', '*/10 * * * *',
--     $$ select net.http_post(
--          url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/carmen-health-probe',
--          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
--          body := '{}'::jsonb
--        ); $$
--   );
