-- Shared-agency dashboards (e.g. DMM-MC) live on the agency's home tenant (DMM).
-- MarketingCaptain can SELECT them via user_can_access_client / cross-tenant agency
-- access, but INSERT/UPDATE/DELETE / dashboard_shares were still locked to the
-- session tenant — so the list fix alone left create/rename/delete/share broken,
-- and new dashboards kept landing on the wrong tenant (Aviali on MC while peers
-- are on DMM).
--
-- Align writes with the existing shared-agency scope (no role elevation): a user
-- may manage a dashboard only when they already have access to its agency/client,
-- and creates must land on the agency/client home tenant.

-- 1) Backfill mis-homed dashboards + their share rows onto the agency home tenant.
UPDATE public.crm_dashboards d
SET tenant_id = a.tenant_id
FROM public.agencies a
WHERE d.agency_id = a.id
  AND d.tenant_id IS DISTINCT FROM a.tenant_id;

UPDATE public.dashboard_shares s
SET tenant_id = d.tenant_id
FROM public.crm_dashboards d
WHERE s.dashboard_id = d.id
  AND s.tenant_id IS DISTINCT FROM d.tenant_id;

-- 2) Helper: may the user manage this dashboard (within existing agency/client scope)?
CREATE OR REPLACE FUNCTION public.user_can_manage_crm_dashboard(
  _user_id uuid,
  _tenant_id uuid,
  _agency_id uuid,
  _client_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR (
      NOT public.user_is_restricted_client_viewer(_user_id)
      AND (
        _tenant_id = public.get_user_tenant_id(_user_id)
        OR (
          _agency_id IS NOT NULL
          AND public.user_has_cross_tenant_agency_access(_user_id, _agency_id)
        )
        OR (
          _client_id IS NOT NULL
          AND public.user_can_access_client(_user_id, _client_id)
        )
      )
    );
$$;

-- 3) crm_dashboards write policies
DROP POLICY IF EXISTS "Users can create dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can create dashboards in their tenant"
ON public.crm_dashboards FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    NOT public.user_is_restricted_client_viewer(auth.uid())
    AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR (
        agency_id IS NOT NULL
        AND public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
        AND tenant_id = (SELECT a.tenant_id FROM public.agencies a WHERE a.id = agency_id)
      )
      OR (
        client_id IS NOT NULL
        AND public.user_can_access_client(auth.uid(), client_id)
        AND tenant_id = (SELECT c.tenant_id FROM public.clients c WHERE c.id = client_id)
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can update dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can update dashboards in their tenant"
ON public.crm_dashboards FOR UPDATE TO authenticated
USING (
  public.user_can_manage_crm_dashboard(auth.uid(), tenant_id, agency_id, client_id)
)
WITH CHECK (
  public.user_can_manage_crm_dashboard(auth.uid(), tenant_id, agency_id, client_id)
);

DROP POLICY IF EXISTS "Users can delete dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can delete dashboards in their tenant"
ON public.crm_dashboards FOR DELETE TO authenticated
USING (
  public.user_can_manage_crm_dashboard(auth.uid(), tenant_id, agency_id, client_id)
);

-- 4) dashboard_shares: manage if you can manage the parent dashboard
DROP POLICY IF EXISTS "Users can manage their own shares" ON public.dashboard_shares;
CREATE POLICY "Users can manage their own shares"
ON public.dashboard_shares FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.get_user_tenant_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.crm_dashboards d
    WHERE d.id = dashboard_shares.dashboard_id
      AND public.user_can_manage_crm_dashboard(auth.uid(), d.tenant_id, d.agency_id, d.client_id)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.get_user_tenant_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.crm_dashboards d
    WHERE d.id = dashboard_shares.dashboard_id
      AND d.tenant_id = dashboard_shares.tenant_id
      AND public.user_can_manage_crm_dashboard(auth.uid(), d.tenant_id, d.agency_id, d.client_id)
  )
);

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'claude',
  'rls_align_shared_agency_dashboards',
  'crm_dashboards+dashboard_shares',
  jsonb_build_object(
    'rule', 'shared agency dashboards writable from accessing tenant within existing agency/client scope',
    'also', 'backfill dashboard.tenant_id to agencies.tenant_id when mismatched'
  )
);
