-- Add connection_user_id to chat_messages
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS connection_user_id uuid REFERENCES auth.users(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_connection_user_id 
ON chat_messages(connection_user_id);

-- Update get_chat_contacts function to filter by connection_user_id and exclude blocked
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
SET search_path TO 'public'
AS $function$
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
  -- Clients (only non-blocked)
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
    false as is_blocked,
    c.manychat_subscriber_id,
    c.active_chat_provider
  FROM clients c
  JOIN agencies a ON c.agency_id = a.id
  WHERE c.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.client_id = c.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )

  UNION ALL

  -- Leads (only non-blocked)
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
    false as is_blocked,
    l.manychat_subscriber_id,
    l.active_chat_provider
  FROM leads l
  LEFT JOIN agencies a ON l.agency_id = a.id
  WHERE l.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.lead_id = l.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )

  UNION ALL

  -- Groups (only non-blocked)
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
    false as is_blocked,
    NULL::text as manychat_subscriber_id,
    NULL::chat_provider as active_chat_provider
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON g.agency_id = a.id
  WHERE g.tenant_id = current_tenant_id
  AND g.is_blocked = false
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.group_id = g.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )

  ORDER BY last_message_at DESC NULLS LAST;
END;
$function$;

-- Update get_unknown_chat_contacts to filter by connection_user_id and exclude blocked
CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts()
RETURNS TABLE(
  id text, 
  name text, 
  sender_phone text, 
  contact_type text, 
  last_message_at timestamp with time zone, 
  unread_count bigint, 
  is_blocked boolean, 
  agency_id uuid, 
  agency_name text, 
  wid text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  effective_tenant_id UUID;
  current_user_id UUID;
BEGIN
  effective_tenant_id := get_effective_tenant_id();
  current_user_id := auth.uid();
  
  IF effective_tenant_id IS NULL OR current_user_id IS NULL THEN
    RAISE EXCEPTION 'No active tenant or user found';
  END IF;

  RETURN QUERY
  -- Unknown contacts (only non-blocked)
  SELECT 
    cm.sender_phone::TEXT as id,
    COALESCE(cm.sender_name, cm.sender_phone) as name,
    cm.sender_phone,
    'unknown'::TEXT,
    MAX(cm.created_at) as last_message_at,
    COUNT(*) FILTER (WHERE cm.read_at IS NULL AND cm.direction = 'inbound')::BIGINT as unread_count,
    false as is_blocked,
    NULL::UUID as agency_id,
    NULL::TEXT as agency_name,
    NULL::TEXT as wid
  FROM chat_messages cm
  WHERE cm.tenant_id = effective_tenant_id
    AND cm.client_id IS NULL
    AND cm.lead_id IS NULL
    AND cm.group_id IS NULL
    AND cm.sender_phone IS NOT NULL
    AND cm.provider = 'green_api'
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  GROUP BY cm.sender_phone, cm.sender_name
  
  ORDER BY last_message_at DESC NULLS LAST;
END;
$function$;