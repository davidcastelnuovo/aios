
CREATE TABLE public.integration_alerts_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  account_id TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('disconnected','blocked','reconnected')),
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_alerts_log_lookup
  ON public.integration_alerts_log (tenant_id, provider, account_id, alert_type, fired_at DESC);

GRANT SELECT ON public.integration_alerts_log TO authenticated;
GRANT ALL ON public.integration_alerts_log TO service_role;

ALTER TABLE public.integration_alerts_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their integration alerts"
ON public.integration_alerts_log
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_effective_tenant_id()
  OR public.is_super_admin(auth.uid())
);
