-- Fix search_path security warning for get_chat_contacts
DROP FUNCTION IF EXISTS get_chat_contacts(UUID, UUID[], TEXT, INT, INT);

CREATE OR REPLACE FUNCTION get_chat_contacts(
  p_tenant_id UUID,
  p_agency_ids UUID[],
  p_search_term TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  agency_id UUID,
  agency_name TEXT,
  manychat_subscriber_id TEXT,
  unread_count BIGINT,
  contact_type TEXT,
  last_message_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Clients
  SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    c.agency_id,
    a.name as agency_name,
    c.manychat_subscriber_id,
    COALESCE(
      (SELECT COUNT(*)::BIGINT 
       FROM chat_messages cm 
       WHERE cm.client_id = c.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL),
      0
    ) as unread_count,
    'client'::TEXT as contact_type,
    (SELECT MAX(created_at) 
     FROM chat_messages cm2 
     WHERE cm2.client_id = c.id) as last_message_at
  FROM clients c
  LEFT JOIN agencies a ON a.id = c.agency_id
  WHERE c.agency_id = ANY(p_agency_ids)
    AND (p_search_term IS NULL OR c.name ILIKE '%' || p_search_term || '%')
  
  UNION ALL
  
  -- Leads
  SELECT 
    l.id,
    l.company_name as name,
    l.phone,
    l.email,
    l.agency_id,
    a.name as agency_name,
    l.manychat_subscriber_id,
    COALESCE(
      (SELECT COUNT(*)::BIGINT 
       FROM chat_messages cm 
       WHERE cm.lead_id = l.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL),
      0
    ) as unread_count,
    'lead'::TEXT as contact_type,
    (SELECT MAX(created_at) 
     FROM chat_messages cm2 
     WHERE cm2.lead_id = l.id) as last_message_at
  FROM leads l
  LEFT JOIN agencies a ON a.id = l.agency_id
  WHERE l.agency_id = ANY(p_agency_ids)
    AND (p_search_term IS NULL OR l.company_name ILIKE '%' || p_search_term || '%')
  
  ORDER BY last_message_at DESC NULLS LAST, name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;