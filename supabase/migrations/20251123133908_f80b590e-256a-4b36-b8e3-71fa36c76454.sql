-- Drop old confusing policies
DROP POLICY IF EXISTS "Users can view their connection messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view unknown contact messages in their tenant" ON public.chat_messages;
DROP POLICY IF EXISTS "Owners can view blocked contact messages" ON public.chat_messages;

-- Create new strict policy: user must be in their current tenant AND own the connection
CREATE POLICY "Users view their connection messages in current tenant"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  -- Super admins see everything
  is_super_admin(auth.uid())
  OR
  -- Messages from my connection + my current tenant (non-blocked)
  (
    connection_user_id = auth.uid()
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND is_blocked = false
  )
  OR
  -- Owners see everything in their tenant (including blocked)
  (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
);