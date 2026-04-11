
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view telegram messages in their tenant" ON public.telegram_messages;

-- Create new SELECT policy that allows viewing from any tenant the user belongs to
CREATE POLICY "Users can view telegram messages in their tenants"
ON public.telegram_messages
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
  OR is_super_admin(auth.uid())
);
