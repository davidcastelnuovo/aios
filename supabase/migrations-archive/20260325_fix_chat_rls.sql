-- Fix chat_messages RLS: super admins should only see their own tenant's messages
-- and only their own connection_user_id unless they explicitly have access

-- Drop existing policies
DROP POLICY IF EXISTS "Users view their connection messages in current tenant" ON chat_messages;
DROP POLICY IF EXISTS "Users can view chat_messages in their tenant" ON chat_messages;
DROP POLICY IF EXISTS "Users can view chat_messages from shared agencies" ON chat_messages;
DROP POLICY IF EXISTS "Super admins can manage chat_messages with permission" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert chat_messages in their tenant" ON chat_messages;
DROP POLICY IF EXISTS "Users can update chat_messages in their tenant" ON chat_messages;

-- SELECT: each user sees only their own connection messages within their tenant
-- Super admins are NOT exempt — they see only their own connection too
CREATE POLICY "Users view own connection messages"
ON chat_messages FOR SELECT TO authenticated
USING (
  connection_user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- INSERT: users can insert messages for their own connection within their tenant
CREATE POLICY "Users insert own connection messages"
ON chat_messages FOR INSERT TO authenticated
WITH CHECK (
  connection_user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- UPDATE: users can update only their own connection messages
CREATE POLICY "Users update own connection messages"
ON chat_messages FOR UPDATE TO authenticated
USING (
  connection_user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Service role bypass (for webhooks and Edge Functions that use service_role key)
-- This is handled automatically by Supabase when using service_role key
