-- Add contact_name column to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Drop the existing get_chat_contacts function (with all its variations)
DROP FUNCTION IF EXISTS get_chat_contacts(uuid, uuid[], text, integer, integer);
DROP FUNCTION IF EXISTS get_chat_contacts();

-- Create new get_chat_contacts function with contact_name support
CREATE OR REPLACE FUNCTION get_chat_contacts()
RETURNS TABLE (
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
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_tenant_id uuid;
BEGIN
  current_tenant_id := get_user_tenant_id(auth.uid());
  
  IF current_tenant_id IS NULL THEN
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
       AND cm.is_blocked = false),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.client_id = c.id) as last_message_at,
    COALESCE(
      (SELECT cm.is_blocked 
       FROM chat_messages cm 
       WHERE cm.client_id = c.id 
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
       AND cm.is_blocked = false),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.lead_id = l.id) as last_message_at,
    COALESCE(
      (SELECT cm.is_blocked 
       FROM chat_messages cm 
       WHERE cm.lead_id = l.id 
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
       AND cm.is_blocked = false),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.group_id = g.id) as last_message_at,
    COALESCE(
      (SELECT cm.is_blocked 
       FROM chat_messages cm 
       WHERE cm.group_id = g.id 
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
  GROUP BY cm.sender_phone, cm.sender_name

  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;