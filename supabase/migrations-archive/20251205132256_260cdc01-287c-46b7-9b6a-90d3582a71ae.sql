-- Fix tasks SELECT policy to restrict campaigners to only see their assigned tasks
-- Drop and recreate the SELECT policy

DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON public.tasks;

CREATE POLICY "Users can view tasks from accessible agencies" 
ON public.tasks 
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_effective_tenant_id() 
    AND (
      -- Owners and team managers can see all tasks in tenant
      has_role(auth.uid(), 'owner'::app_role) 
      OR has_role(auth.uid(), 'team_manager'::app_role)
      -- Campaigners can only see tasks assigned to them
      OR (
        has_role(auth.uid(), 'campaigner'::app_role) 
        AND campaigner_id = (SELECT campaigner_id FROM profiles WHERE id = auth.uid())
      )
    )
  )
);