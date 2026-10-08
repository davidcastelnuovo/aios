-- Fix 1: Allow owners to view all users in their tenant
CREATE POLICY "Owners can view all users in their tenant"
ON tenant_users FOR SELECT
USING (
  tenant_id IN (
    SELECT ur.tenant_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
      AND ur.role = 'owner'
  )
);

-- Fix 2: Fix INSERT policy for campaigners to properly check tenant_id
DROP POLICY IF EXISTS "Team managers and owners can insert campaigners" ON campaigners;

CREATE POLICY "Team managers and owners can insert campaigners"
ON campaigners FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = tenant_id  -- Reference to the new record's tenant_id column
      AND ur.role IN ('owner', 'team_manager')
  )
);