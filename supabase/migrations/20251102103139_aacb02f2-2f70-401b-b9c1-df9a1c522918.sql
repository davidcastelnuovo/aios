-- Add RLS policies for team managers on tasks table
CREATE POLICY "Team managers can view tasks from managed agencies"
ON public.tasks
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'team_manager'::app_role)
    AND user_manages_agency(auth.uid(), agency_id)
  )
);

CREATE POLICY "Team managers can manage tasks from managed agencies"
ON public.tasks
FOR ALL
USING (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'team_manager'::app_role)
    AND user_manages_agency(auth.uid(), agency_id)
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'team_manager'::app_role)
    AND user_manages_agency(auth.uid(), agency_id)
  )
);