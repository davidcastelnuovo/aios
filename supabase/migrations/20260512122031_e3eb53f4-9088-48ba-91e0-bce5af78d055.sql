DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON public.tasks;

CREATE POLICY "Users can view tasks from accessible agencies"
ON public.tasks
FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR ((tenant_id = get_effective_tenant_id()) AND has_role(auth.uid(), 'owner'::app_role))
  OR ((tenant_id = get_effective_tenant_id()) AND has_role(auth.uid(), 'team_manager'::app_role) AND user_manages_agency(auth.uid(), agency_id))
  OR (has_role(auth.uid(), 'team_manager'::app_role) AND user_manages_agency(auth.uid(), agency_id) AND user_has_cross_tenant_agency_access(auth.uid(), agency_id))
  OR (
    (has_role(auth.uid(), 'campaigner'::app_role) OR has_role(auth.uid(), 'seo'::app_role))
    AND (
      (campaigner_id IS NOT NULL AND campaigner_id = get_user_campaigner_id(auth.uid()))
      OR (client_id IS NOT NULL AND client_id = ANY(COALESCE(get_user_client_ids(auth.uid()), ARRAY[]::uuid[])))
      OR (created_by IS NOT NULL AND created_by = auth.uid())
    )
  )
);