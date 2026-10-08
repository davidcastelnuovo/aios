
CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts()
 RETURNS TABLE(id text, name text, sender_phone text, contact_type text, last_message_at timestamp with time zone, unread_count bigint, is_blocked boolean, agency_id uuid, agency_name text, wid text)
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
  -- Unknown contacts (only non-blocked) - grouped by sender_phone only
  -- Use the most recent inbound message sender_name, fallback to any sender_name, then phone
  SELECT 
    cm.sender_phone::TEXT as id,
    COALESCE(
      -- Get the sender_name from the most recent inbound message
      (SELECT cm2.sender_name 
       FROM chat_messages cm2 
       WHERE cm2.sender_phone = cm.sender_phone 
         AND cm2.tenant_id = effective_tenant_id
         AND cm2.connection_user_id = current_user_id
         AND cm2.direction = 'inbound'
         AND cm2.sender_name IS NOT NULL
       ORDER BY cm2.created_at DESC 
       LIMIT 1),
      -- Fallback to most recent sender_name from any message
      (SELECT cm3.sender_name 
       FROM chat_messages cm3 
       WHERE cm3.sender_phone = cm.sender_phone 
         AND cm3.tenant_id = effective_tenant_id
         AND cm3.connection_user_id = current_user_id
         AND cm3.sender_name IS NOT NULL
       ORDER BY cm3.created_at DESC 
       LIMIT 1),
      -- Final fallback to phone number
      cm.sender_phone
    ) as name,
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
  GROUP BY cm.sender_phone
  
  ORDER BY last_message_at DESC NULLS LAST;
END;
$function$;
