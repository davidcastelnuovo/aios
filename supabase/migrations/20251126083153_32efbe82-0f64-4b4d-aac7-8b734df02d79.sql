-- Simplify UPDATE policy for tasks - remove agency check from WITH CHECK to avoid nested RLS
DROP POLICY IF EXISTS "Users can update tasks in accessible agencies" ON tasks;

CREATE POLICY "Users can update tasks in accessible agencies"
ON tasks FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
);