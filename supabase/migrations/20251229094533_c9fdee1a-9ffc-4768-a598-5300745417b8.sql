-- Drop and recreate search_contacts_for_chat to include unknown contacts search
DROP FUNCTION IF EXISTS search_contacts_for_chat(text, uuid);

CREATE OR REPLACE FUNCTION search_contacts_for_chat(p_search_term text, p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(
  contact_id text,
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
  active_chat_provider chat_provider,
  sender_phone text,
  has_messages boolean,
  whatsapp_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
  search_pattern text;
BEGIN
  current_tenant_id := COALESCE(p_tenant_id, get_user_tenant_id(auth.uid()));
  current_user_id := auth.uid();
  search_pattern := '%' || lower(p_search_term) || '%';
  
  IF current_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Clients
  SELECT 
    c.id::text as contact_id,
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
       AND cm.direction = 'inbound' 
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
    c.active_chat_provider,
    c.phone as sender_phone,
    EXISTS(SELECT 1 FROM chat_messages cm WHERE cm.client_id = c.id AND cm.connection_user_id = current_user_id) as has_messages,
    c.whatsapp_avatar_url
  FROM clients c
  JOIN agencies a ON c.agency_id = a.id
  WHERE c.tenant_id = current_tenant_id
  AND (
    lower(c.name) LIKE search_pattern
    OR lower(COALESCE(c.contact_name, '')) LIKE search_pattern
    OR lower(COALESCE(c.phone, '')) LIKE search_pattern
    OR lower(COALESCE(c.email, '')) LIKE search_pattern
  )

  UNION ALL

  -- Leads
  SELECT 
    l.id::text as contact_id,
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
       AND cm.direction = 'inbound' 
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
    l.active_chat_provider,
    l.phone as sender_phone,
    EXISTS(SELECT 1 FROM chat_messages cm WHERE cm.lead_id = l.id AND cm.connection_user_id = current_user_id) as has_messages,
    l.whatsapp_avatar_url
  FROM leads l
  LEFT JOIN agencies a ON l.agency_id = a.id
  WHERE l.tenant_id = current_tenant_id
  AND (
    lower(l.company_name) LIKE search_pattern
    OR lower(COALESCE(l.contact_name, '')) LIKE search_pattern
    OR lower(COALESCE(l.phone, '')) LIKE search_pattern
    OR lower(COALESCE(l.email, '')) LIKE search_pattern
  )

  UNION ALL

  -- Groups
  SELECT 
    g.id::text as contact_id,
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
       AND cm.direction = 'inbound' 
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
    'green_api'::chat_provider as active_chat_provider,
    NULL::text as sender_phone,
    EXISTS(SELECT 1 FROM chat_messages cm WHERE cm.group_id = g.id AND cm.connection_user_id = current_user_id) as has_messages,
    g.avatar_url as whatsapp_avatar_url
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON g.agency_id = a.id
  WHERE g.tenant_id = current_tenant_id
  AND g.is_blocked = false
  AND (
    lower(g.group_name) LIKE search_pattern
    OR lower(COALESCE(g.description, '')) LIKE search_pattern
  )

  UNION ALL

  -- Unknown contacts (messages without client/lead/group)
  SELECT 
    uc.sender_phone as contact_id,
    'unknown'::text as contact_type,
    COALESCE(uc.sender_name, uc.sender_phone) as name,
    NULL::text as contact_name,
    uc.sender_phone as phone,
    NULL::text as email,
    NULL::uuid as agency_id,
    NULL::text as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.sender_phone = uc.sender_phone 
       AND cm.client_id IS NULL 
       AND cm.lead_id IS NULL 
       AND cm.group_id IS NULL
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id
       AND cm.tenant_id = current_tenant_id),
      0
    ) as unread_count,
    uc.last_message_at,
    false as is_blocked,
    NULL::text as manychat_subscriber_id,
    'green_api'::chat_provider as active_chat_provider,
    uc.sender_phone as sender_phone,
    true as has_messages,
    NULL::text as whatsapp_avatar_url
  FROM (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.sender_name,
      MAX(cm.created_at) OVER (PARTITION BY cm.sender_phone) as last_message_at
    FROM chat_messages cm
    WHERE cm.tenant_id = current_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.is_blocked = false
      AND (
        lower(cm.sender_phone) LIKE search_pattern
        OR lower(COALESCE(cm.sender_name, '')) LIKE search_pattern
      )
    ORDER BY cm.sender_phone, cm.created_at DESC
  ) uc
  WHERE NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.sender_phone = uc.sender_phone
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;