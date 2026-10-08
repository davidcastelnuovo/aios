-- Fix tasks SELECT policy to properly check user_manages_agency for team managers
DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON tasks;

CREATE POLICY "Users can view tasks from accessible agencies"
  ON tasks FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        -- Owners see all tasks in their tenant
        has_role(auth.uid(), 'owner'::app_role)
        -- Team managers see tasks from agencies they manage
        OR (has_role(auth.uid(), 'team_manager'::app_role) AND user_manages_agency(auth.uid(), agency_id))
        -- Campaigners see only their assigned tasks
        OR (has_role(auth.uid(), 'campaigner'::app_role) AND campaigner_id = get_user_campaigner_id(auth.uid()))
      )
    )
  );