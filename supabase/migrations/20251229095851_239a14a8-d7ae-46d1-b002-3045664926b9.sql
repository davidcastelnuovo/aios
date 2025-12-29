-- Update get_unknown_chat_contacts to accept p_tenant_id parameter for proper tenant isolation
CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  sender_phone text,
  sender_name text,
  unread_count bigint,
  last_message_at timestamptz,
  whatsapp_avatar_url text,
  connection_user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_tenant_id uuid;
  current_user_id uuid;
BEGIN
  -- Use provided tenant_id, fallback to get_effective_tenant_id()
  effective_tenant_id := COALESCE(p_tenant_id, get_effective_tenant_id());
  current_user_id := auth.uid();

  RETURN QUERY
  WITH latest_messages AS (
    SELECT DISTINCT ON (cm.sender_phone)
      cm.sender_phone,
      cm.sender_name,
      cm.created_at,
      cm.connection_user_id,
      (cm.raw_provider_data->>'senderProfileImage')::text as avatar_url
    FROM chat_messages cm
    WHERE cm.tenant_id = effective_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.direction = 'incoming'
      -- Filter by connection_user_id if user is not super admin
      AND (
        is_super_admin(current_user_id)
        OR cm.connection_user_id = current_user_id
      )
      -- Exclude hidden chats
      AND NOT EXISTS (
        SELECT 1 FROM hidden_chats hc
        WHERE hc.user_id = current_user_id
          AND hc.tenant_id = effective_tenant_id
          AND hc.sender_phone = cm.sender_phone
      )
      -- Exclude blocked contacts
      AND NOT EXISTS (
        SELECT 1 FROM blocked_contacts bc
        WHERE bc.connection_user_id = current_user_id
          AND bc.tenant_id = effective_tenant_id
          AND bc.sender_phone = cm.sender_phone
      )
    ORDER BY cm.sender_phone, cm.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      cm.sender_phone,
      COUNT(*) FILTER (
        WHERE cm.read_at IS NULL 
        AND cm.direction = 'incoming'
        AND NOT EXISTS (
          SELECT 1 FROM manually_read_contacts mrc
          WHERE mrc.user_id = current_user_id
            AND mrc.tenant_id = effective_tenant_id
            AND mrc.sender_phone = cm.sender_phone
        )
      ) as unread
    FROM chat_messages cm
    WHERE cm.tenant_id = effective_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND (
        is_super_admin(current_user_id)
        OR cm.connection_user_id = current_user_id
      )
    GROUP BY cm.sender_phone
  )
  SELECT 
    lm.sender_phone,
    lm.sender_name,
    COALESCE(uc.unread, 0) as unread_count,
    lm.created_at as last_message_at,
    lm.avatar_url as whatsapp_avatar_url,
    lm.connection_user_id
  FROM latest_messages lm
  LEFT JOIN unread_counts uc ON lm.sender_phone = uc.sender_phone
  ORDER BY lm.created_at DESC;
END;
$$;