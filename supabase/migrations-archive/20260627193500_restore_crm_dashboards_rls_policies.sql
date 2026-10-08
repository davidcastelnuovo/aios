-- Restore RLS policies for public.crm_dashboards.
-- The 2026-06-22 stack-cutover rebuild recreated the table with RLS ENABLED but
-- dropped all policies; crm_dashboards was missed by the later piecemeal restores,
-- leaving it default-deny (the "Dashboards" tab showed empty for everyone, incl. super-admin).
-- These mirror the last known-good definitions (SELECT from 20260512120348; writes from 20260123051737,
-- modernized to get_user_tenant_id + restricted-viewer guard). No widening vs. crm_tables scoping.

-- SELECT: role-scoped read
DROP POLICY IF EXISTS "Users can view dashboards in their tenant" ON public.crm_dashboards;
DROP POLICY IF EXISTS "Users can view dashboards by role scope" ON public.crm_dashboards;
CREATE POLICY "Users can view dashboards by role scope"
ON public.crm_dashboards FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (client_id IS NOT NULL AND public.user_can_access_client(auth.uid(), client_id))
  OR (
    NOT public.user_is_restricted_client_viewer(auth.uid())
    AND client_id IS NULL
    AND (tenant_id = public.get_user_tenant_id(auth.uid())
         OR public.user_has_cross_tenant_agency_access(auth.uid(), agency_id))
  )
);

-- INSERT
DROP POLICY IF EXISTS "Users can create dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can create dashboards in their tenant"
ON public.crm_dashboards FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (NOT public.user_is_restricted_client_viewer(auth.uid())
      AND tenant_id = public.get_user_tenant_id(auth.uid()))
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can update dashboards in their tenant"
ON public.crm_dashboards FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (NOT public.user_is_restricted_client_viewer(auth.uid())
      AND tenant_id = public.get_user_tenant_id(auth.uid()))
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (NOT public.user_is_restricted_client_viewer(auth.uid())
      AND tenant_id = public.get_user_tenant_id(auth.uid()))
);

-- DELETE
DROP POLICY IF EXISTS "Users can delete dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can delete dashboards in their tenant"
ON public.crm_dashboards FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (NOT public.user_is_restricted_client_viewer(auth.uid())
      AND tenant_id = public.get_user_tenant_id(auth.uid()))
);
