-- Update get_unknown_chat_contacts to filter blocked groups  
CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts()
 RETURNS TABLE(id text, name text, sender_phone text, contact_type text, last_message_at timestamp with time zone, unread_count bigint, is_blocked boolean, agency_id uuid, agency_name text, wid text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  effective_tenant_id UUID;
BEGIN
  -- Get effective tenant ID (respects super admin context)
  effective_tenant_id := get_effective_tenant_id();
  
  IF effective_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No active tenant found';
  END IF;

  RETURN QUERY
  -- Part 1: Registered WhatsApp groups (only non-blocked)
  SELECT 
    wg.id::TEXT,
    wg.group_name,
    NULL::TEXT as sender_phone,
    'group'::TEXT,
    (
      SELECT MAX(cm.created_at)
      FROM chat_messages cm
      WHERE cm.group_id = wg.id 
        AND cm.tenant_id = effective_tenant_id
    ) as last_message_at,
    (
      SELECT COUNT(*)::BIGINT
      FROM chat_messages cm
      WHERE cm.group_id = wg.id 
        AND cm.tenant_id = effective_tenant_id
        AND cm.read_at IS NULL
        AND cm.direction = 'inbound'
    ) as unread_count,
    wg.is_blocked,
    wg.agency_id,
    (SELECT a.name FROM agencies a WHERE a.id = wg.agency_id) as agency_name,
    NULL::TEXT as wid
  FROM whatsapp_groups wg
  WHERE wg.tenant_id = effective_tenant_id
    AND wg.is_blocked = false  -- Only show non-blocked groups
    AND EXISTS (
      SELECT 1 FROM chat_messages cm 
      WHERE cm.group_id = wg.id 
        AND cm.tenant_id = effective_tenant_id
    )

  UNION ALL

  -- Part 2: Unregistered groups (from chat_messages with @g.us wid)
  -- We show these temporarily until they are registered
  SELECT 
    cm.group_id::TEXT,
    COALESCE(cm.sender_name, cm.channel, cm.group_id::TEXT) as name,
    NULL::TEXT as sender_phone,
    'group'::TEXT,
    MAX(cm.created_at) as last_message_at,
    COUNT(*) FILTER (WHERE cm.read_at IS NULL AND cm.direction = 'inbound')::BIGINT as unread_count,
    bool_or(cm.is_blocked) as is_blocked,
    NULL::UUID as agency_id,
    NULL::TEXT as agency_name,
    (
      SELECT jsonb_extract_path_text(cm2.raw_provider_data, 'messageData', 'chatId')
      FROM chat_messages cm2
      WHERE cm2.group_id = cm.group_id 
        AND cm2.tenant_id = effective_tenant_id
      ORDER BY cm2.created_at DESC
      LIMIT 1
    ) as wid
  FROM chat_messages cm
  WHERE cm.tenant_id = effective_tenant_id
    AND cm.group_id IS NOT NULL
    AND cm.provider = 'green_api'
    AND NOT EXISTS (
      SELECT 1 FROM whatsapp_groups wg 
      WHERE wg.id = cm.group_id 
        AND wg.tenant_id = effective_tenant_id
    )
  GROUP BY cm.group_id, cm.sender_name, cm.channel

  UNION ALL

  -- Part 3: Unknown contacts (no client/lead/group)
  SELECT 
    cm.sender_phone::TEXT as id,
    COALESCE(cm.sender_name, cm.sender_phone) as name,
    cm.sender_phone,
    'unknown'::TEXT,
    MAX(cm.created_at) as last_message_at,
    COUNT(*) FILTER (WHERE cm.read_at IS NULL AND cm.direction = 'inbound')::BIGINT as unread_count,
    bool_or(cm.is_blocked) as is_blocked,
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
  GROUP BY cm.sender_phone, cm.sender_name
  
  ORDER BY last_message_at DESC NULLS LAST;
END;
$function$;