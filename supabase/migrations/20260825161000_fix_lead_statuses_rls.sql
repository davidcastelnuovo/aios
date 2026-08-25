-- lead_statuses SELECT was locked to get_user_tenant_id() (home / stale
-- user_active_tenant). Switching org in the UI hid secondary statuses in
-- the CRM dropdowns even when the rows existed for the active tenant.
--
-- Align SELECT with get_effective_tenant_id() + membership. Keep writes
-- owner-only (plus super admin) — do not widen who can create/edit statuses.
-- Resolve the tenant with get_effective_tenant_id() so an owner working in
-- the currently selected org can still manage statuses.

DROP POLICY IF EXISTS "Users can view statuses in their tenant" ON public.lead_statuses;
DROP POLICY IF EXISTS "Owners can manage statuses" ON public.lead_statuses;

CREATE POLICY "Users can view statuses in their tenant"
ON public.lead_statuses
FOR SELECT
USING (
  tenant_id = public.get_effective_tenant_id()
  OR public.user_is_tenant_member(tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Owners can manage statuses"
ON public.lead_statuses
FOR ALL
USING (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.get_effective_tenant_id()
    AND public.has_role(auth.uid(), 'owner'::app_role)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.get_effective_tenant_id()
    AND public.has_role(auth.uid(), 'owner'::app_role)
  )
);
