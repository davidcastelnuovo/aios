
CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts(p_tenant_id uuid)
 RETURNS TABLE(id text, name text, sender_phone text, contact_type text, last_message_at timestamp with time zone, unread_count bigint, is_blocked boolean, agency_id uuid, agency_name text, wid text, whatsapp_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF p_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH last_messages AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.created_at as last_message_at,
      (cm.raw_provider_data->>'senderProfileImage')::text as avatar_url
    FROM chat_messages cm
    WHERE cm.tenant_id = p_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.is_blocked = false
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  inbound_names AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.sender_name
    FROM chat_messages cm
    WHERE cm.tenant_id = p_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.direction = 'inbound'
      AND cm.sender_name IS NOT NULL
      AND cm.sender_name != ''
      AND cm.is_blocked = false
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  unread_counts AS (
    SELECT
      cm.sender_phone,
      COUNT(*)::bigint AS unread_count
    FROM chat_messages cm
    WHERE cm.tenant_id = p_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.direction = 'inbound'
      AND cm.read_at IS NULL
      AND cm.is_blocked = false
    GROUP BY cm.sender_phone
  )
  SELECT
    lm.sender_phone::text AS id,
    COALESCE(inb.sender_name, lm.sender_phone) AS name,
    lm.sender_phone,
    'unknown'::text AS contact_type,
    lm.last_message_at,
    COALESCE(uc.unread_count, 0) AS unread_count,
    false AS is_blocked,
    NULL::uuid AS agency_id,
    NULL::text AS agency_name,
    NULL::text AS wid,
    lm.avatar_url AS whatsapp_avatar_url
  FROM last_messages lm
  LEFT JOIN inbound_names inb ON inb.sender_phone = lm.sender_phone
  LEFT JOIN unread_counts uc ON uc.sender_phone = lm.sender_phone
  ORDER BY lm.last_message_at DESC;
END;
$function$;
