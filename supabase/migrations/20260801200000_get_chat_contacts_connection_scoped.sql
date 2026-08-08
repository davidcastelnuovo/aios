-- The chat page calls get_chat_contacts(p_tenant_id, p_connection_user_ids, p_provider),
-- but production only ever received the older () and (p_tenant_id) overloads, so the
-- conversation list fails with PGRST202 and no conversations render at all.
--
-- This adds the missing overload, including the `unknown` branch that surfaces threads
-- whose messages are not yet linked to a client or lead -- which is every Meta WhatsApp
-- conversation with a number that is not already in the CRM.
--
-- Unlike the definition it replaces, this one does not take the caller's word for
-- p_tenant_id or p_connection_user_ids. Both are validated against what the caller can
-- actually reach, so neither parameter can be used to read another tenant's or another
-- user's conversations.

CREATE OR REPLACE FUNCTION public.get_chat_contacts(
  p_tenant_id uuid,
  p_connection_user_ids uuid[],
  p_provider public.chat_provider
)
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
  active_chat_provider public.chat_provider,
  whatsapp_avatar_url text,
  sender_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
  is_admin boolean;
  allowed_user_ids uuid[];
  user_ids uuid[];
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  is_admin := COALESCE(public.is_super_admin(current_user_id), false);
  current_tenant_id := public.get_user_tenant_id(current_user_id);

  -- Only a super admin may ask for a tenant other than their own.
  IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM current_tenant_id THEN
    IF NOT is_admin THEN
      RETURN;
    END IF;
    current_tenant_id := p_tenant_id;
  END IF;

  IF current_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- Connection owners this caller may read: their own line, a line explicitly shared
  -- with them, and org-wide lines.
  SELECT array_agg(DISTINCT owners.owner_id)
  INTO allowed_user_ids
  FROM (
    SELECT current_user_id AS owner_id
    UNION
    SELECT ti.user_id
    FROM public.tenant_integrations ti
    WHERE ti.tenant_id = current_tenant_id
      AND ti.user_id IS NOT NULL
      AND (
        is_admin
        OR ti.user_id = current_user_id
        OR ti.connection_visibility = 'org'
        OR EXISTS (
          SELECT 1
          FROM public.integration_user_permissions iup
          WHERE iup.integration_id = ti.id
            AND iup.user_id = current_user_id
        )
      )
  ) owners;

  user_ids := CASE
    WHEN p_connection_user_ids IS NULL THEN ARRAY[current_user_id]
    ELSE ARRAY(
      SELECT unnest(p_connection_user_ids)
      INTERSECT
      SELECT unnest(COALESCE(allowed_user_ids, ARRAY[current_user_id]))
    )
  END;

  IF array_length(user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      c.id AS contact_id,
      'client'::text AS contact_type,
      c.name AS name,
      c.contact_name AS contact_name,
      c.phone AS phone,
      c.email AS email,
      c.agency_id AS agency_id,
      a.name AS agency_name,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM public.chat_messages cm
        WHERE cm.client_id = c.id
          AND cm.direction = 'inbound'
          AND cm.read_at IS NULL
          AND cm.is_blocked = false
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
      ), 0) AS unread_count,
      (
        SELECT MAX(cm.created_at)
        FROM public.chat_messages cm
        WHERE cm.client_id = c.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      ) AS last_message_at,
      false AS is_blocked,
      c.manychat_subscriber_id AS manychat_subscriber_id,
      COALESCE(p_provider, (
        SELECT cm.provider
        FROM public.chat_messages cm
        WHERE cm.client_id = c.id
          AND cm.connection_user_id = ANY(user_ids)
          AND cm.is_blocked = false
        ORDER BY cm.created_at DESC
        LIMIT 1
      )) AS active_chat_provider,
      c.whatsapp_avatar_url AS whatsapp_avatar_url,
      c.phone AS sender_phone
    FROM public.clients c
    JOIN public.agencies a ON c.agency_id = a.id
    WHERE c.tenant_id = current_tenant_id
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages cm
        WHERE cm.client_id = c.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_contacts bc
        WHERE bc.client_id = c.id
          AND bc.connection_user_id = current_user_id
          AND bc.tenant_id = current_tenant_id
      )

    UNION ALL

    SELECT
      l.id AS contact_id,
      'lead'::text AS contact_type,
      l.company_name AS name,
      l.contact_name AS contact_name,
      l.phone AS phone,
      l.email AS email,
      l.agency_id AS agency_id,
      a.name AS agency_name,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM public.chat_messages cm
        WHERE cm.lead_id = l.id
          AND cm.direction = 'inbound'
          AND cm.read_at IS NULL
          AND cm.is_blocked = false
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
      ), 0) AS unread_count,
      (
        SELECT MAX(cm.created_at)
        FROM public.chat_messages cm
        WHERE cm.lead_id = l.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      ) AS last_message_at,
      false AS is_blocked,
      l.manychat_subscriber_id AS manychat_subscriber_id,
      COALESCE(p_provider, (
        SELECT cm.provider
        FROM public.chat_messages cm
        WHERE cm.lead_id = l.id
          AND cm.connection_user_id = ANY(user_ids)
          AND cm.is_blocked = false
        ORDER BY cm.created_at DESC
        LIMIT 1
      )) AS active_chat_provider,
      l.whatsapp_avatar_url AS whatsapp_avatar_url,
      l.phone AS sender_phone
    FROM public.leads l
    LEFT JOIN public.agencies a ON l.agency_id = a.id
    WHERE l.tenant_id = current_tenant_id
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages cm
        WHERE cm.lead_id = l.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_contacts bc
        WHERE bc.lead_id = l.id
          AND bc.connection_user_id = current_user_id
          AND bc.tenant_id = current_tenant_id
      )

    UNION ALL

    SELECT
      g.id AS contact_id,
      'group'::text AS contact_type,
      g.group_name AS name,
      NULL::text AS contact_name,
      NULL::text AS phone,
      NULL::text AS email,
      g.agency_id AS agency_id,
      a.name AS agency_name,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM public.chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.direction = 'inbound'
          AND cm.read_at IS NULL
          AND cm.is_blocked = false
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
      ), 0) AS unread_count,
      (
        SELECT MAX(cm.created_at)
        FROM public.chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      ) AS last_message_at,
      false AS is_blocked,
      NULL::text AS manychat_subscriber_id,
      COALESCE(p_provider, (
        SELECT cm.provider
        FROM public.chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.connection_user_id = ANY(user_ids)
          AND cm.is_blocked = false
        ORDER BY cm.created_at DESC
        LIMIT 1
      )) AS active_chat_provider,
      g.whatsapp_avatar_url AS whatsapp_avatar_url,
      NULL::text AS sender_phone
    FROM public.whatsapp_groups g
    LEFT JOIN public.agencies a ON g.agency_id = a.id
    WHERE g.tenant_id = current_tenant_id
      AND g.is_blocked = false
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.connection_user_id = ANY(user_ids)
          AND (p_provider IS NULL OR cm.provider = p_provider)
          AND cm.is_blocked = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_contacts bc
        WHERE bc.group_id = g.id
          AND bc.connection_user_id = current_user_id
          AND bc.tenant_id = current_tenant_id
      )

    UNION ALL

    -- Threads with a number that is not linked to a client, lead or group yet.
    SELECT
      md5(cm.sender_phone)::uuid AS contact_id,
      'unknown'::text AS contact_type,
      COALESCE((array_agg(NULLIF(cm.sender_name, '') ORDER BY cm.created_at DESC))[1], cm.sender_phone, 'Unknown') AS name,
      NULL::text AS contact_name,
      cm.sender_phone AS phone,
      NULL::text AS email,
      NULL::uuid AS agency_id,
      NULL::text AS agency_name,
      COUNT(*) FILTER (
        WHERE cm.direction = 'inbound'
          AND cm.read_at IS NULL
          AND cm.is_blocked = false
      )::bigint AS unread_count,
      MAX(cm.created_at) AS last_message_at,
      false AS is_blocked,
      NULL::text AS manychat_subscriber_id,
      COALESCE(p_provider, (array_agg(cm.provider ORDER BY cm.created_at DESC))[1]) AS active_chat_provider,
      (array_agg((cm.raw_provider_data->>'senderProfileImage')::text ORDER BY cm.created_at DESC))[1] AS whatsapp_avatar_url,
      cm.sender_phone AS sender_phone
    FROM public.chat_messages cm
    WHERE cm.tenant_id = current_tenant_id
      AND cm.client_id IS NULL
      AND cm.lead_id IS NULL
      AND cm.group_id IS NULL
      AND cm.sender_phone IS NOT NULL
      AND cm.connection_user_id = ANY(user_ids)
      AND (p_provider IS NULL OR cm.provider = p_provider)
      AND cm.is_blocked = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_contacts bc
        WHERE bc.sender_phone = cm.sender_phone
          AND bc.connection_user_id = current_user_id
          AND bc.tenant_id = current_tenant_id
      )
    GROUP BY cm.sender_phone
  ) sub
  ORDER BY sub.last_message_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_contacts(uuid, uuid[], public.chat_provider) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_contacts(uuid, uuid[], public.chat_provider) TO service_role;

-- The unknown branch scans every message that is not linked to a client, lead or
-- group, which is most of the table.
CREATE INDEX IF NOT EXISTS idx_chat_messages_unlinked_thread
  ON public.chat_messages (connection_user_id, tenant_id, sender_phone, created_at DESC)
  WHERE client_id IS NULL
    AND lead_id IS NULL
    AND group_id IS NULL
    AND is_blocked = false;
