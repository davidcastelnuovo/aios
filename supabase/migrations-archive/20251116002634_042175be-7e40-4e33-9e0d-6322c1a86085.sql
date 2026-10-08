-- Step 1: Remove the constraint that requires either client_id or lead_id
ALTER TABLE chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_contact_check;

-- Step 2: Make client_id nullable (if it isn't already)
ALTER TABLE chat_messages 
ALTER COLUMN client_id DROP NOT NULL;

-- Step 3: Add new columns for unconfigured contacts
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS sender_phone TEXT,
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS blocked_by_user_id UUID REFERENCES auth.users(id);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_phone ON chat_messages(sender_phone);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_blocked ON chat_messages(is_blocked);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_sender ON chat_messages(tenant_id, sender_phone);

-- Step 5: Update existing messages to populate sender_phone from clients/leads
UPDATE chat_messages cm
SET sender_phone = c.phone
FROM clients c
WHERE cm.client_id = c.id AND cm.sender_phone IS NULL AND c.phone IS NOT NULL;

UPDATE chat_messages cm
SET sender_phone = l.phone
FROM leads l
WHERE cm.lead_id = l.id AND cm.sender_phone IS NULL AND l.phone IS NOT NULL;

-- Step 6: Add RLS policy for unknown contacts
CREATE POLICY "Users can view unknown contact messages in their tenant"
  ON chat_messages FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND client_id IS NULL 
    AND lead_id IS NULL
    AND is_blocked = false
  );

-- Step 7: Add RLS policy for blocked contacts (owners only)
CREATE POLICY "Owners can view blocked contact messages"
  ON chat_messages FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND is_blocked = true
    AND has_role(auth.uid(), 'owner'::app_role)
  );

-- Step 8: Add RLS policy for blocking/unblocking contacts
CREATE POLICY "Owners can update blocked status"
  ON chat_messages FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'owner'::app_role)
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'owner'::app_role)
  );