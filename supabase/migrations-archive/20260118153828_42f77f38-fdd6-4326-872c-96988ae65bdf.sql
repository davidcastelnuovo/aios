-- Fix chat_messages RLS policy to only show messages from user's own connection
-- This prevents users from seeing chats from other users' Green API connections

DROP POLICY IF EXISTS "Users view their connection messages in current tenant" ON chat_messages;

CREATE POLICY "Users view their connection messages in current tenant"
ON chat_messages FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR (
    connection_user_id = auth.uid() 
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND is_blocked = false
  )
);