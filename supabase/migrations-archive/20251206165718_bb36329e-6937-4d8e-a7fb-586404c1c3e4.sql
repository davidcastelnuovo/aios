-- Update get_unknown_chat_contacts to check campaigners and use sender_name from WhatsApp
CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts()
RETURNS TABLE(
  id TEXT,
  name TEXT,
  sender_phone TEXT,
  contact_type TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT,
  is_blocked BOOLEAN,
  agency_id UUID,
  agency_name TEXT,
  wid TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WITH phone_contacts AS (
    SELECT DISTINCT cm.sender_phone as phone
    FROM chat_messages cm
    WHERE cm.tenant_id = effective_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.provider = 'green_api'
      AND cm.connection_user_id = current_user_id
      AND cm.is_blocked = false
  ),
  inbound_names AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone as phone,
      cm.sender_name
    FROM chat_messages cm
    WHERE cm.tenant_id = effective_tenant_id
      AND cm.connection_user_id = current_user_id
      AND cm.direction = 'inbound'
      AND cm.sender_name IS NOT NULL
      AND cm.sender_phone IS NOT NULL
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  -- Check if phone matches a campaigner (normalize both phones to last 9 digits)
  campaigner_matches AS (
    SELECT 
      c.full_name as campaigner_name,
      substring(regexp_replace(c.phone, '[^0-9]', '', 'g') from '.{9}$') as normalized_phone
    FROM campaigners c
    WHERE c.tenant_id = effective_tenant_id
      AND c.phone IS NOT NULL
      AND c.phone != ''
  )
  SELECT 
    pc.phone::TEXT as id,
    -- Priority: 1. Campaigner name, 2. WhatsApp sender_name, 3. Phone number
    COALESCE(
      (SELECT cm_match.campaigner_name 
       FROM campaigner_matches cm_match 
       WHERE cm_match.normalized_phone = substring(regexp_replace(pc.phone, '[^0-9]', '', 'g') from '.{9}$')
       LIMIT 1),
      inb.sender_name, 
      pc.phone
    ) as name,
    pc.phone as sender_phone,
    'unknown'::TEXT as contact_type,
    (SELECT MAX(cm.created_at) 
     FROM chat_messages cm 
     WHERE cm.sender_phone = pc.phone 
       AND cm.tenant_id = effective_tenant_id
       AND cm.connection_user_id = current_user_id) as last_message_at,
    (SELECT COUNT(*)::BIGINT 
     FROM chat_messages cm 
     WHERE cm.sender_phone = pc.phone 
       AND cm.tenant_id = effective_tenant_id
       AND cm.connection_user_id = current_user_id
       AND cm.read_at IS NULL 
       AND cm.direction = 'inbound') as unread_count,
    false as is_blocked,
    NULL::UUID as agency_id,
    NULL::TEXT as agency_name,
    NULL::TEXT as wid
  FROM phone_contacts pc
  LEFT JOIN inbound_names inb ON inb.phone = pc.phone
  WHERE NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.sender_phone = pc.phone
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = effective_tenant_id
  )
  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;