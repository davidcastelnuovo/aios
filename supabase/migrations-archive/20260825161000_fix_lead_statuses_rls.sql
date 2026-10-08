-- lead_statuses SELECT was locked to get_user_tenant_id() (home / stale
-- user_active_tenant). Switching org in the UI hid secondary statuses in
-- the CRM dropdowns even when the rows existed for the active tenant.
--
-- Align SELECT with get_effective_tenant_id() + membership. Keep writes
-- owner-only (plus super admin) — do not widen who can create/edit statuses.
--
-- Do NOT use has_role(uid, 'owner') here. That helper checks
-- user_roles.tenant_id = get_user_tenant_id(uid) (home tenant). Combined
-- with tenant_id = get_effective_tenant_id(), an owner of tenant A who is
-- only a member of tenant B could manage B's lead_statuses after switching
-- org. Require an owner row for THIS tenant instead.

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
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'owner'::app_role
        AND ur.tenant_id = lead_statuses.tenant_id
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.get_effective_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'owner'::app_role
        AND ur.tenant_id = lead_statuses.tenant_id
    )
  )
);
