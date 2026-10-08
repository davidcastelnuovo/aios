
-- Drop and recreate the SELECT policy for tasks to include cross-tenant shared agency access for team managers
DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON public.tasks;

CREATE POLICY "Users can view tasks from accessible agencies"
ON public.tasks
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR (
    -- Owner sees all tasks in their tenant
    (tenant_id = get_effective_tenant_id()) AND has_role(auth.uid(), 'owner'::app_role)
  )
  OR (
    -- Team manager sees tasks in their tenant for agencies they manage
    (tenant_id = get_effective_tenant_id()) AND has_role(auth.uid(), 'team_manager'::app_role) AND user_manages_agency(auth.uid(), agency_id)
  )
  OR (
    -- Team manager sees tasks from SHARED agencies they manage (cross-tenant)
    has_role(auth.uid(), 'team_manager'::app_role) 
    AND user_manages_agency(auth.uid(), agency_id)
    AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
  OR (
    -- Campaigner sees only their assigned tasks in their tenant
    (tenant_id = get_effective_tenant_id()) AND has_role(auth.uid(), 'campaigner'::app_role) AND (campaigner_id = get_user_campaigner_id(auth.uid()))
  )
);
