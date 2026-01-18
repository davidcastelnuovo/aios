-- Remove super admin bypass from chat_messages RLS policies
-- Users should ONLY see messages for their own connection_user_id

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view chat messages in their tenant" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete chat messages" ON public.chat_messages;

-- New SELECT policy: ONLY own connection, no super admin bypass
CREATE POLICY "Users can view their own connection messages"
ON public.chat_messages FOR SELECT
USING (
  connection_user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND is_blocked = false
);

-- New INSERT policy: can only insert for own connection
CREATE POLICY "Users can insert their own connection messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
  connection_user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- New UPDATE policy: can only update own connection messages
CREATE POLICY "Users can update their own connection messages"
ON public.chat_messages FOR UPDATE
USING (
  connection_user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
)
WITH CHECK (
  connection_user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- New DELETE policy: can only delete own connection messages
CREATE POLICY "Users can delete their own connection messages"
ON public.chat_messages FOR DELETE
USING (
  connection_user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
);