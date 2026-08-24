-- Tasks carry the tenant the creator was working in, not the home tenant of the
-- client/agency they belong to. For a shared agency that only works in one
-- direction: "Shared-agency cross-tenant task view" covers the borrowing tenant,
-- while every other SELECT branch requires tenant_id = the viewer's tenant. A
-- task created on the promo agency from the Promo workspace was therefore
-- invisible to MarketingCaptain, which owns that agency and its clients.
--
-- Mirror the shared-agency policy for the owning direction, and let the same
-- rows stay editable so a task can be completed from the tenant that owns it.

DROP POLICY IF EXISTS "Own-agency task view across tenants" ON public.tasks;
CREATE POLICY "Own-agency task view across tenants"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  agency_id IS NOT NULL
  AND public.user_owns_agency(auth.uid(), agency_id)
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR (
      public.has_role(auth.uid(), 'team_manager'::app_role)
      AND public.user_manages_agency(auth.uid(), agency_id)
    )
    OR (campaigner_id IS NOT NULL AND campaigner_id = public.get_user_campaigner_id(auth.uid()))
    OR (sales_person_id IS NOT NULL AND sales_person_id = public.get_user_sales_person_id(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can update tasks in accessible agencies" ON public.tasks;
CREATE POLICY "Users can update tasks in accessible agencies"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    (
      tenant_id = public.get_effective_tenant_id()
      OR public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
      OR public.user_owns_agency(auth.uid(), agency_id)
    )
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'team_manager'::app_role)
      OR public.has_role(auth.uid(), 'sales_person'::app_role)
      OR (
        public.has_role(auth.uid(), 'campaigner'::app_role)
        AND campaigner_id = public.get_user_campaigner_id(auth.uid())
      )
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    (
      tenant_id = public.get_effective_tenant_id()
      OR public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
      OR public.user_owns_agency(auth.uid(), agency_id)
    )
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'team_manager'::app_role)
      OR public.has_role(auth.uid(), 'sales_person'::app_role)
      OR (
        public.has_role(auth.uid(), 'campaigner'::app_role)
        AND campaigner_id = public.get_user_campaigner_id(auth.uid())
      )
    )
  )
);
