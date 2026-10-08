-- Update get_chat_contacts to accept optional p_connection_user_ids array
-- so users can view chats from shared connections (owned by other users they have access to)
-- as well as filter to a specific connection.

CREATE OR REPLACE FUNCTION public.get_chat_contacts(
  p_tenant_id uuid DEFAULT NULL::uuid,
  p_connection_user_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(contact_id uuid, contact_type text, name text, contact_name text, phone text, email text, agency_id uuid, agency_name text, unread_count bigint, last_message_at timestamp with time zone, is_blocked boolean, manychat_subscriber_id text, active_chat_provider chat_provider, whatsapp_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
  user_ids uuid[];
BEGIN
  current_tenant_id := COALESCE(p_tenant_id, get_user_tenant_id(auth.uid()));
  current_user_id := auth.uid();

  IF current_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Default to current user only when no array provided
  user_ids := COALESCE(p_connection_user_ids, ARRAY[current_user_id]);

  RETURN QUERY
  -- Clients
  SELECT
    c.id, 'client'::text, c.name, c.contact_name, c.phone, c.email,
    c.agency_id, a.name,
    COALESCE((SELECT COUNT(*)::bigint FROM chat_messages cm
       WHERE cm.client_id = c.id AND cm.direction = 'inbound'
       AND cm.read_at IS NULL AND cm.is_blocked = false
       AND cm.connection_user_id = ANY(user_ids)), 0),
    (SELECT MAX(created_at) FROM chat_messages cm
       WHERE cm.client_id = c.id AND cm.connection_user_id = ANY(user_ids)),
    false, c.manychat_subscriber_id, c.active_chat_provider, c.whatsapp_avatar_url
  FROM clients c
  JOIN agencies a ON c.agency_id = a.id
  WHERE c.tenant_id = current_tenant_id
  AND EXISTS (SELECT 1 FROM chat_messages cm
    WHERE cm.client_id = c.id AND cm.connection_user_id = ANY(user_ids) AND cm.is_blocked = false)
  AND NOT EXISTS (SELECT 1 FROM blocked_contacts bc
    WHERE bc.client_id = c.id AND bc.connection_user_id = current_user_id AND bc.tenant_id = current_tenant_id)

  UNION ALL

  -- Leads
  SELECT
    l.id, 'lead'::text, l.company_name, l.contact_name, l.phone, l.email,
    l.agency_id, a.name,
    COALESCE((SELECT COUNT(*)::bigint FROM chat_messages cm
       WHERE cm.lead_id = l.id AND cm.direction = 'inbound'
       AND cm.read_at IS NULL AND cm.is_blocked = false
       AND cm.connection_user_id = ANY(user_ids)), 0),
    (SELECT MAX(created_at) FROM chat_messages cm
       WHERE cm.lead_id = l.id AND cm.connection_user_id = ANY(user_ids)),
    false, l.manychat_subscriber_id, l.active_chat_provider, l.whatsapp_avatar_url
  FROM leads l
  LEFT JOIN agencies a ON l.agency_id = a.id
  WHERE l.tenant_id = current_tenant_id
  AND EXISTS (SELECT 1 FROM chat_messages cm
    WHERE cm.lead_id = l.id AND cm.connection_user_id = ANY(user_ids) AND cm.is_blocked = false)
  AND NOT EXISTS (SELECT 1 FROM blocked_contacts bc
    WHERE bc.lead_id = l.id AND bc.connection_user_id = current_user_id AND bc.tenant_id = current_tenant_id)

  UNION ALL

  -- Groups
  SELECT
    g.id, 'group'::text, g.group_name, NULL::text, NULL::text, NULL::text,
    g.agency_id, a.name,
    COALESCE((SELECT COUNT(*)::bigint FROM chat_messages cm
       WHERE cm.group_id = g.id AND cm.direction = 'inbound'
       AND cm.read_at IS NULL AND cm.is_blocked = false
       AND cm.connection_user_id = ANY(user_ids)), 0),
    (SELECT MAX(created_at) FROM chat_messages cm
       WHERE cm.group_id = g.id AND cm.connection_user_id = ANY(user_ids)),
    false, NULL::text, NULL::chat_provider, g.whatsapp_avatar_url
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON g.agency_id = a.id
  WHERE g.tenant_id = current_tenant_id AND g.is_blocked = false
  AND EXISTS (SELECT 1 FROM chat_messages cm
    WHERE cm.group_id = g.id AND cm.connection_user_id = ANY(user_ids) AND cm.is_blocked = false)
  AND NOT EXISTS (SELECT 1 FROM blocked_contacts bc
    WHERE bc.group_id = g.id AND bc.connection_user_id = current_user_id AND bc.tenant_id = current_tenant_id)

  ORDER BY last_message_at DESC NULLS LAST;
END;
$function$;