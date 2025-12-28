
-- Add sales_person to tasks DELETE policy
DROP POLICY IF EXISTS "Users can delete tasks in accessible agencies" ON public.tasks;

CREATE POLICY "Users can delete tasks in accessible agencies"
ON public.tasks FOR DELETE
USING (
  is_super_admin(auth.uid())
  OR
  (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = tasks.tenant_id
      AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
    )
    AND (
      (tenant_id = get_user_tenant_id(auth.uid()))
      OR
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
      ))
    )
  )
);
