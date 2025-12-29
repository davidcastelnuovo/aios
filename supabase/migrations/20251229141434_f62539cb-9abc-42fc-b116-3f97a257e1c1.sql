-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_unknown_chat_contacts(uuid);

-- Recreate with correct direction value ('inbound' instead of 'incoming')
CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts(p_tenant_id uuid)
RETURNS TABLE(
  sender_phone text,
  sender_name text,
  last_message text,
  last_message_at timestamp with time zone,
  unread_count bigint,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH latest_messages AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.sender_name,
      cm.content as last_message,
      cm.created_at as last_message_at,
      cm.whatsapp_avatar_url as avatar_url
    FROM chat_messages cm
    WHERE cm.tenant_id = p_tenant_id
      AND cm.sender_phone IS NOT NULL
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.direction = 'inbound'
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      cm.sender_phone,
      COUNT(*) as unread_count
    FROM chat_messages cm
    WHERE cm.tenant_id = p_tenant_id
      AND cm.sender_phone IS NOT NULL
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.direction = 'inbound'
      AND cm.is_read = false
    GROUP BY cm.sender_phone
  )
  SELECT 
    lm.sender_phone,
    lm.sender_name,
    lm.last_message,
    lm.last_message_at,
    COALESCE(uc.unread_count, 0) as unread_count,
    lm.avatar_url
  FROM latest_messages lm
  LEFT JOIN unread_counts uc ON lm.sender_phone = uc.sender_phone
  ORDER BY lm.last_message_at DESC;
END;
$$;