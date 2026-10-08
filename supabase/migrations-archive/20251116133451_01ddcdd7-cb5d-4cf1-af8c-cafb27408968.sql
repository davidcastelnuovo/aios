-- Create search function for dynamic contact search
CREATE OR REPLACE FUNCTION search_contacts_for_chat(p_search_term TEXT)
RETURNS TABLE (
  contact_id uuid,
  contact_type text,
  name text,
  contact_name text,
  phone text,
  email text,
  agency_id uuid,
  agency_name text,
  manychat_subscriber_id text,
  active_chat_provider chat_provider,
  has_messages boolean,
  last_message_at timestamp with time zone,
  unread_count bigint,
  is_blocked boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_agency_ids uuid[];
BEGIN
  -- Get user's tenant and agencies
  v_tenant_id := get_user_tenant_id(auth.uid());
  v_user_agency_ids := get_user_agency_ids(auth.uid());
  
  -- Search clients
  RETURN QUERY
  SELECT 
    c.id as contact_id,
    'client'::text as contact_type,
    c.name,
    c.contact_name,
    c.phone,
    c.email,
    c.agency_id,
    a.name as agency_name,
    c.manychat_subscriber_id,
    c.active_chat_provider,
    EXISTS(
      SELECT 1 FROM chat_messages cm 
      WHERE cm.client_id = c.id AND cm.tenant_id = v_tenant_id
    ) as has_messages,
    (
      SELECT MAX(cm.created_at)
      FROM chat_messages cm
      WHERE cm.client_id = c.id AND cm.tenant_id = v_tenant_id
    ) as last_message_at,
    (
      SELECT COUNT(*)::bigint
      FROM chat_messages cm
      WHERE cm.client_id = c.id 
        AND cm.tenant_id = v_tenant_id
        AND cm.direction = 'incoming'
        AND cm.read_at IS NULL
    ) as unread_count,
    COALESCE(
      (
        SELECT cm.is_blocked
        FROM chat_messages cm
        WHERE cm.client_id = c.id AND cm.tenant_id = v_tenant_id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ),
      false
    ) as is_blocked
  FROM clients c
  JOIN agencies a ON a.id = c.agency_id
  WHERE c.tenant_id = v_tenant_id
    AND (c.agency_id = ANY(v_user_agency_ids) OR has_role(auth.uid(), 'owner'))
    AND (
      c.name ILIKE '%' || p_search_term || '%'
      OR c.contact_name ILIKE '%' || p_search_term || '%'
      OR c.phone ILIKE '%' || p_search_term || '%'
      OR c.email ILIKE '%' || p_search_term || '%'
    )
  
  UNION ALL
  
  -- Search leads
  SELECT 
    l.id as contact_id,
    'lead'::text as contact_type,
    l.company_name as name,
    l.contact_name,
    l.phone,
    l.email,
    l.agency_id,
    a.name as agency_name,
    l.manychat_subscriber_id,
    l.active_chat_provider,
    EXISTS(
      SELECT 1 FROM chat_messages cm 
      WHERE cm.lead_id = l.id AND cm.tenant_id = v_tenant_id
    ) as has_messages,
    (
      SELECT MAX(cm.created_at)
      FROM chat_messages cm
      WHERE cm.lead_id = l.id AND cm.tenant_id = v_tenant_id
    ) as last_message_at,
    (
      SELECT COUNT(*)::bigint
      FROM chat_messages cm
      WHERE cm.lead_id = l.id 
        AND cm.tenant_id = v_tenant_id
        AND cm.direction = 'incoming'
        AND cm.read_at IS NULL
    ) as unread_count,
    COALESCE(
      (
        SELECT cm.is_blocked
        FROM chat_messages cm
        WHERE cm.lead_id = l.id AND cm.tenant_id = v_tenant_id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ),
      false
    ) as is_blocked
  FROM leads l
  JOIN agencies a ON a.id = l.agency_id
  WHERE l.tenant_id = v_tenant_id
    AND (l.agency_id = ANY(v_user_agency_ids) OR has_role(auth.uid(), 'owner'))
    AND (
      l.company_name ILIKE '%' || p_search_term || '%'
      OR l.contact_name ILIKE '%' || p_search_term || '%'
      OR l.phone ILIKE '%' || p_search_term || '%'
      OR l.email ILIKE '%' || p_search_term || '%'
    )
  
  UNION ALL
  
  -- Search WhatsApp groups
  SELECT 
    g.id as contact_id,
    'group'::text as contact_type,
    g.group_name as name,
    NULL::text as contact_name,
    NULL::text as phone,
    NULL::text as email,
    g.agency_id,
    a.name as agency_name,
    NULL::text as manychat_subscriber_id,
    'green_api'::chat_provider as active_chat_provider,
    EXISTS(
      SELECT 1 FROM chat_messages cm 
      WHERE cm.group_id = g.id AND cm.tenant_id = v_tenant_id
    ) as has_messages,
    (
      SELECT MAX(cm.created_at)
      FROM chat_messages cm
      WHERE cm.group_id = g.id AND cm.tenant_id = v_tenant_id
    ) as last_message_at,
    (
      SELECT COUNT(*)::bigint
      FROM chat_messages cm
      WHERE cm.group_id = g.id 
        AND cm.tenant_id = v_tenant_id
        AND cm.direction = 'incoming'
        AND cm.read_at IS NULL
    ) as unread_count,
    COALESCE(
      (
        SELECT cm.is_blocked
        FROM chat_messages cm
        WHERE cm.group_id = g.id AND cm.tenant_id = v_tenant_id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ),
      false
    ) as is_blocked
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON a.id = g.agency_id
  WHERE g.tenant_id = v_tenant_id
    AND (g.agency_id IS NULL OR g.agency_id = ANY(v_user_agency_ids) OR has_role(auth.uid(), 'owner'))
    AND g.group_name ILIKE '%' || p_search_term || '%'
  
  ORDER BY has_messages DESC, last_message_at DESC NULLS LAST, name
  LIMIT 20;
END;
$$;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_clients_search 
ON clients(tenant_id, name, contact_name, phone) 
WHERE phone IS NOT NULL OR contact_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_search 
ON leads(tenant_id, company_name, contact_name, phone)
WHERE phone IS NOT NULL OR contact_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_search
ON whatsapp_groups(tenant_id, group_name);