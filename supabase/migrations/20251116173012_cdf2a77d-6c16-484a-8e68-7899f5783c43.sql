-- Add user_id to tenant_integrations for per-user connections
ALTER TABLE tenant_integrations 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add connection_user_id to chat_messages to track which user's connection was used
ALTER TABLE chat_messages 
ADD COLUMN connection_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_chat_messages_connection_user_id ON chat_messages(connection_user_id);
CREATE INDEX idx_tenant_integrations_user_id ON tenant_integrations(user_id);

-- Update RLS policy for tenant_integrations to be user-specific
DROP POLICY IF EXISTS "Owners can manage tenant integrations" ON tenant_integrations;
DROP POLICY IF EXISTS "Users with accounting permission can view" ON tenant_integrations;

CREATE POLICY "Users can manage their own integrations"
ON tenant_integrations
FOR ALL
USING (
  user_id = auth.uid() 
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  user_id = auth.uid() 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can view their own integrations"
ON tenant_integrations
FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_super_admin(auth.uid())
);

-- Update RLS policies for chat_messages to be connection-specific
DROP POLICY IF EXISTS "Users can manage chat_messages in their tenant" ON chat_messages;
DROP POLICY IF EXISTS "Users can view chat_messages in their tenant" ON chat_messages;
DROP POLICY IF EXISTS "Users can view chat_messages from shared agencies" ON chat_messages;
DROP POLICY IF EXISTS "Super admins can manage chat_messages with permission" ON chat_messages;
DROP POLICY IF EXISTS "Super admins can view chat_messages with permission" ON chat_messages;

-- Users can only see messages from their own connection
CREATE POLICY "Users can view their connection messages"
ON chat_messages
FOR SELECT
USING (
  connection_user_id = auth.uid()
  OR sent_by_user_id = auth.uid()
  OR is_super_admin(auth.uid())
);

-- Users can insert messages through their connection
CREATE POLICY "Users can insert messages through their connection"
ON chat_messages
FOR INSERT
WITH CHECK (
  (sent_by_user_id = auth.uid() AND connection_user_id = auth.uid())
  OR is_super_admin(auth.uid())
);

-- Users can update their connection messages (e.g., mark as read)
CREATE POLICY "Users can update their connection messages"
ON chat_messages
FOR UPDATE
USING (
  connection_user_id = auth.uid()
  OR sent_by_user_id = auth.uid()
  OR is_super_admin(auth.uid())
);

-- Users can delete their connection messages
CREATE POLICY "Users can delete their connection messages"
ON chat_messages
FOR DELETE
USING (
  connection_user_id = auth.uid()
  OR is_super_admin(auth.uid())
);

-- Update get_chat_contacts function to filter by connection_user_id
CREATE OR REPLACE FUNCTION public.get_chat_contacts()
RETURNS TABLE(
  contact_id uuid,
  contact_type text,
  name text,
  contact_name text,
  phone text,
  email text,
  agency_id uuid,
  agency_name text,
  unread_count bigint,
  last_message_at timestamp with time zone,
  is_blocked boolean,
  manychat_subscriber_id text,
  active_chat_provider chat_provider
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
BEGIN
  current_tenant_id := get_user_tenant_id(auth.uid());
  current_user_id := auth.uid();
  
  IF current_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Clients
  SELECT 
    c.id as contact_id,
    'client'::text as contact_type,
    c.name,
    c.contact_name,
    c.phone,
    c.email,
    c.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.client_id = c.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.client_id = c.id 
     AND cm.connection_user_id = current_user_id) as last_message_at,
    COALESCE(
      (SELECT cm.is_blocked 
       FROM chat_messages cm 
       WHERE cm.client_id = c.id 
       AND cm.connection_user_id = current_user_id
       ORDER BY cm.created_at DESC 
       LIMIT 1),
      false
    ) as is_blocked,
    c.manychat_subscriber_id,
    c.active_chat_provider
  FROM clients c
  JOIN agencies a ON c.agency_id = a.id
  WHERE c.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.client_id = c.id
    AND cm.connection_user_id = current_user_id
  )

  UNION ALL

  -- Leads
  SELECT 
    l.id as contact_id,
    'lead'::text as contact_type,
    l.company_name as name,
    l.contact_name,
    l.phone,
    l.email,
    l.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.lead_id = l.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.lead_id = l.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    COALESCE(
      (SELECT cm.is_blocked 
       FROM chat_messages cm 
       WHERE cm.lead_id = l.id 
       AND cm.connection_user_id = current_user_id
       ORDER BY cm.created_at DESC 
       LIMIT 1),
      false
    ) as is_blocked,
    l.manychat_subscriber_id,
    l.active_chat_provider
  FROM leads l
  LEFT JOIN agencies a ON l.agency_id = a.id
  WHERE l.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.lead_id = l.id
    AND cm.connection_user_id = current_user_id
  )

  UNION ALL

  -- Groups
  SELECT 
    g.id as contact_id,
    'group'::text as contact_type,
    g.group_name as name,
    NULL::text as contact_name,
    NULL::text as phone,
    NULL::text as email,
    g.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.group_id = g.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.group_id = g.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    COALESCE(
      (SELECT cm.is_blocked 
       FROM chat_messages cm 
       WHERE cm.group_id = g.id 
       AND cm.connection_user_id = current_user_id
       ORDER BY cm.created_at DESC 
       LIMIT 1),
      false
    ) as is_blocked,
    NULL::text as manychat_subscriber_id,
    NULL::chat_provider as active_chat_provider
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON g.agency_id = a.id
  WHERE g.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.group_id = g.id
    AND cm.connection_user_id = current_user_id
  )

  UNION ALL

  -- Unknown contacts
  SELECT 
    NULL::uuid as contact_id,
    'unknown'::text as contact_type,
    COALESCE(cm.sender_name, cm.sender_phone, 'Unknown') as name,
    NULL::text as contact_name,
    cm.sender_phone as phone,
    NULL::text as email,
    NULL::uuid as agency_id,
    NULL::text as agency_name,
    COUNT(CASE WHEN cm.direction = 'incoming' AND cm.read_at IS NULL AND cm.is_blocked = false THEN 1 END)::bigint as unread_count,
    MAX(cm.created_at) as last_message_at,
    bool_or(cm.is_blocked) as is_blocked,
    NULL::text as manychat_subscriber_id,
    NULL::chat_provider as active_chat_provider
  FROM chat_messages cm
  WHERE cm.tenant_id = current_tenant_id
  AND cm.client_id IS NULL
  AND cm.lead_id IS NULL
  AND cm.group_id IS NULL
  AND cm.sender_phone IS NOT NULL
  AND cm.connection_user_id = current_user_id
  GROUP BY cm.sender_phone, cm.sender_name

  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;