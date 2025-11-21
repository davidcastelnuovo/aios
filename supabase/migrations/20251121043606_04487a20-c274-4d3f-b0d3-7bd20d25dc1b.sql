-- Drop the complex policies that check integration permissions
DROP POLICY IF EXISTS "Users can view their connection messages with permission" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages through their connection with permission" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their connection messages with permission" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their connection messages with permission" ON chat_messages;

-- Create simple policies that only check connection_user_id and sent_by_user_id
CREATE POLICY "Users can view their connection messages"
ON chat_messages
FOR SELECT
TO public
USING (
  is_super_admin(auth.uid()) 
  OR connection_user_id = auth.uid()
  OR sent_by_user_id = auth.uid()
);

CREATE POLICY "Users can insert messages through their connection"
ON chat_messages
FOR INSERT
TO public
WITH CHECK (
  is_super_admin(auth.uid())
  OR (connection_user_id = auth.uid() AND sent_by_user_id = auth.uid())
);

CREATE POLICY "Users can update their connection messages"
ON chat_messages
FOR UPDATE
TO public
USING (
  is_super_admin(auth.uid())
  OR connection_user_id = auth.uid()
  OR sent_by_user_id = auth.uid()
);

CREATE POLICY "Users can delete their connection messages"
ON chat_messages
FOR DELETE
TO public
USING (
  is_super_admin(auth.uid())
  OR connection_user_id = auth.uid()
  OR sent_by_user_id = auth.uid()
);