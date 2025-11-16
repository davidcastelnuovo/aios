-- Create whatsapp_groups table to store group information
CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  group_chat_id TEXT NOT NULL, -- The full chatId like 120363416882903532@g.us
  group_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, group_chat_id)
);

-- Add group_id column to chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON public.chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_chat_id ON public.whatsapp_groups(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_tenant_id ON public.whatsapp_groups(tenant_id);

-- Enable RLS
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_groups
CREATE POLICY "Users can view groups in their tenant"
  ON public.whatsapp_groups FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage groups in their tenant"
  ON public.whatsapp_groups FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Update trigger for updated_at
CREATE TRIGGER update_whatsapp_groups_updated_at
  BEFORE UPDATE ON public.whatsapp_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update get_chat_contacts function to include groups
CREATE OR REPLACE FUNCTION public.get_chat_contacts(
  p_tenant_id uuid,
  p_agency_ids uuid[],
  p_search_term text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  email text,
  agency_id uuid,
  agency_name text,
  manychat_subscriber_id text,
  active_chat_provider chat_provider,
  unread_count bigint,
  contact_type text,
  last_message_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
    c.active_chat_provider,
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
    l.active_chat_provider,
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
  
  UNION ALL
  
  -- WhatsApp Groups
  SELECT 
    g.id,
    g.group_name as name,
    NULL::TEXT as phone,
    NULL::TEXT as email,
    g.agency_id,
    a.name as agency_name,
    NULL::TEXT as manychat_subscriber_id,
    'green_api'::chat_provider as active_chat_provider,
    COALESCE(
      (SELECT COUNT(*)::BIGINT 
       FROM chat_messages cm 
       WHERE cm.group_id = g.id 
       AND cm.direction = 'inbound' 
       AND cm.read_at IS NULL),
      0
    ) as unread_count,
    'group'::TEXT as contact_type,
    (SELECT MAX(created_at) 
     FROM chat_messages cm2 
     WHERE cm2.group_id = g.id) as last_message_at
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON a.id = g.agency_id
  WHERE (g.agency_id = ANY(p_agency_ids) OR g.agency_id IS NULL)
    AND g.tenant_id = p_tenant_id
    AND (p_search_term IS NULL OR g.group_name ILIKE '%' || p_search_term || '%')
  
  UNION ALL
  
  -- Unknown contacts (no client, lead, or group)
  SELECT DISTINCT
    NULL::UUID as id,
    COALESCE(cm.sender_name, cm.sender_phone, 'לא מוגדר') as name,
    cm.sender_phone as phone,
    NULL::TEXT as email,
    NULL::UUID as agency_id,
    NULL::TEXT as agency_name,
    NULL::TEXT as manychat_subscriber_id,
    cm.provider as active_chat_provider,
    COUNT(CASE WHEN cm.direction = 'inbound' AND cm.read_at IS NULL THEN 1 END)::BIGINT as unread_count,
    'unknown'::TEXT as contact_type,
    MAX(cm.created_at) as last_message_at
  FROM chat_messages cm
  WHERE cm.tenant_id = p_tenant_id
    AND cm.client_id IS NULL 
    AND cm.lead_id IS NULL
    AND cm.group_id IS NULL
    AND cm.sender_phone IS NOT NULL
    AND (p_search_term IS NULL OR 
         cm.sender_name ILIKE '%' || p_search_term || '%' OR 
         cm.sender_phone ILIKE '%' || p_search_term || '%')
  GROUP BY cm.sender_phone, cm.sender_name, cm.provider
  
  ORDER BY last_message_at DESC NULLS LAST, name
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;