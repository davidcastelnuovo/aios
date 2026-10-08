-- Manual pulse-status overrides for the בדיקת דופק dashboard.
-- Stores human corrections + rationale so the UI can show a different color
-- than the deterministic algorithm, and Carmen can learn calibration rules.

CREATE TABLE IF NOT EXISTS public.campaign_pulse_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  algorithm_status text NOT NULL,
  override_status text NOT NULL CHECK (override_status IN ('green', 'yellow', 'red')),
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 3),
  algorithm_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  algorithm_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_calculated_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz,
  cleared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS campaign_pulse_overrides_client_active_idx
  ON public.campaign_pulse_overrides (client_id, created_at DESC)
  WHERE cleared_at IS NULL;

CREATE INDEX IF NOT EXISTS campaign_pulse_overrides_tenant_idx
  ON public.campaign_pulse_overrides (tenant_id, created_at DESC);

ALTER TABLE public.campaign_pulse_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_pulse_overrides_select" ON public.campaign_pulse_overrides;
CREATE POLICY "campaign_pulse_overrides_select"
  ON public.campaign_pulse_overrides
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR tenant_id = public.get_effective_tenant_id()
    OR (
      EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = campaign_pulse_overrides.client_id
          AND c.agency_id IS NOT NULL
          AND public.user_has_cross_tenant_agency_access((SELECT auth.uid()), c.agency_id)
      )
    )
  );

DROP POLICY IF EXISTS "campaign_pulse_overrides_insert" ON public.campaign_pulse_overrides;
CREATE POLICY "campaign_pulse_overrides_insert"
  ON public.campaign_pulse_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin((SELECT auth.uid()))
    OR (
      tenant_id = public.get_effective_tenant_id()
      AND created_by = (SELECT auth.uid())
      AND (
        public.has_role((SELECT auth.uid()), 'owner'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'team_manager'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'campaigner'::public.app_role)
      )
    )
  );

DROP POLICY IF EXISTS "campaign_pulse_overrides_update" ON public.campaign_pulse_overrides;
CREATE POLICY "campaign_pulse_overrides_update"
  ON public.campaign_pulse_overrides
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR (
      tenant_id = public.get_effective_tenant_id()
      AND (
        public.has_role((SELECT auth.uid()), 'owner'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'team_manager'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'campaigner'::public.app_role)
      )
    )
  )
  WITH CHECK (
    public.is_super_admin((SELECT auth.uid()))
    OR tenant_id = public.get_effective_tenant_id()
  );

COMMENT ON TABLE public.campaign_pulse_overrides IS
  'Human overrides of deterministic campaign pulse colors, with rationale for Carmen calibration.';
