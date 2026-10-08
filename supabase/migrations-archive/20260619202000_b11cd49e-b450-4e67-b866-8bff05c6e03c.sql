
CREATE TABLE public.campaign_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  campaign_id text NOT NULL,
  campaign_name text,
  ad_account_id text,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  details jsonb DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_alerts_tenant ON public.campaign_alerts(tenant_id, created_at DESC);
CREATE INDEX idx_campaign_alerts_open ON public.campaign_alerts(tenant_id, campaign_id, alert_type) WHERE acknowledged_at IS NULL AND resolved_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_alerts TO authenticated;
GRANT ALL ON public.campaign_alerts TO service_role;

ALTER TABLE public.campaign_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view alerts"
ON public.campaign_alerts FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.source_tenant_id = campaign_alerts.tenant_id
      AND ata.accessing_tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "tenant members can update alerts"
ON public.campaign_alerts FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid())
);

CREATE TRIGGER campaign_alerts_set_updated_at
BEFORE UPDATE ON public.campaign_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
