-- Deterministic campaign pulse cache. Populated from already-synced CRM data:
-- no LLM call and no advertising-platform API call is needed.
CREATE TABLE IF NOT EXISTS public.campaign_pulse_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  data_fresh_through date,
  status text NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'no_data')),
  is_ecommerce boolean NOT NULL DEFAULT false,
  spend_7d numeric NOT NULL DEFAULT 0,
  leads_7d numeric NOT NULL DEFAULT 0,
  cpl_7d numeric,
  cpl_change_pct numeric,
  purchases_7d numeric NOT NULL DEFAULT 0,
  revenue_7d numeric NOT NULL DEFAULT 0,
  roas_7d numeric,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'synced_crm',
  UNIQUE (tenant_id, client_id)
);
CREATE INDEX IF NOT EXISTS campaign_pulse_snapshots_tenant_status_idx
  ON public.campaign_pulse_snapshots (tenant_id, status, calculated_at DESC);
CREATE INDEX IF NOT EXISTS campaign_pulse_snapshots_agency_idx
  ON public.campaign_pulse_snapshots (agency_id, calculated_at DESC);
ALTER TABLE public.campaign_pulse_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_pulse_snapshots_read"
  ON public.campaign_pulse_snapshots FOR SELECT TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR (
      tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = (SELECT auth.uid()))
      AND (
        NOT public.has_role((SELECT auth.uid()), 'campaigner'::public.app_role)
        OR client_id = ANY(public.get_user_client_ids((SELECT auth.uid())))
      )
    )
  );

ALTER TABLE public.tenant_heartbeat_settings
  ADD COLUMN IF NOT EXISTS campaign_pulse_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_pulse_phone text,
  ADD COLUMN IF NOT EXISTS campaign_pulse_last_sent_at timestamptz;

-- Atomically reserve one delivery window. This prevents Meta and Google sync
-- completions (or cron retries) from sending the same digest twice.
CREATE OR REPLACE FUNCTION public.claim_campaign_pulse_delivery(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.tenant_heartbeat_settings
  SET campaign_pulse_last_sent_at = now()
  WHERE tenant_id = p_tenant_id
    AND campaign_pulse_enabled = true
    AND campaign_pulse_phone IS NOT NULL
    AND (
      campaign_pulse_last_sent_at IS NULL
      OR campaign_pulse_last_sent_at < now() - interval '4 hours'
    )
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.claim_campaign_pulse_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_pulse_delivery(uuid) TO service_role;

COMMENT ON TABLE public.campaign_pulse_snapshots IS
  'Latest deterministic campaign pulse per active client, calculated only from synced CRM data.';
