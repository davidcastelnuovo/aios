
-- Add sales_person to tasks INSERT and UPDATE policies
-- This allows sales people to create and update tasks

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create tasks in accessible agencies" ON public.tasks;

-- Recreate INSERT policy with sales_person included
CREATE POLICY "Users can create tasks in accessible agencies"
ON public.tasks FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  -- User has permission in their tenant (now including sales_person)
  (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = tasks.tenant_id
      AND ur.role IN ('owner', 'team_manager', 'campaigner', 'sales_person')
    )
    AND (
      -- Agency is in user's tenant
      (agency_id IN (
        SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid())
      ))
      OR
      -- Agency is shared with user's tenant
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
      ))
    )
  )
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update tasks in accessible agencies" ON public.tasks;

-- Recreate UPDATE policy with sales_person included
CREATE POLICY "Users can update tasks in accessible agencies"
ON public.tasks FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR
  (tenant_id = get_user_tenant_id(auth.uid()))
  OR
  (agency_id IN (
    SELECT ata.agency_id 
    FROM agency_tenant_access ata
    WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  ))
)
WITH CHECK (
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
      (agency_id IN (
        SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid())
      ))
      OR
      (agency_id IN (
        SELECT ata.agency_id 
        FROM agency_tenant_access ata
        WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
      ))
    )
  )
);
