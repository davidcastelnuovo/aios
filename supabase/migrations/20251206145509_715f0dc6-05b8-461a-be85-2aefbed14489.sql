-- Create blocked_contacts table to persist blocking even after message deletion
CREATE TABLE public.blocked_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_user_id UUID NOT NULL,
  sender_phone TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blocked_contacts_at_least_one_identifier CHECK (
    sender_phone IS NOT NULL OR client_id IS NOT NULL OR lead_id IS NOT NULL OR group_id IS NOT NULL
  )
);

-- Create unique indexes for each type of contact
CREATE UNIQUE INDEX blocked_contacts_phone_unique 
ON public.blocked_contacts(tenant_id, connection_user_id, sender_phone) 
WHERE sender_phone IS NOT NULL;

CREATE UNIQUE INDEX blocked_contacts_client_unique 
ON public.blocked_contacts(tenant_id, connection_user_id, client_id) 
WHERE client_id IS NOT NULL;

CREATE UNIQUE INDEX blocked_contacts_lead_unique 
ON public.blocked_contacts(tenant_id, connection_user_id, lead_id) 
WHERE lead_id IS NOT NULL;

CREATE UNIQUE INDEX blocked_contacts_group_unique 
ON public.blocked_contacts(tenant_id, connection_user_id, group_id) 
WHERE group_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.blocked_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own blocked contacts"
ON public.blocked_contacts FOR SELECT
USING (connection_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert their own blocked contacts"
ON public.blocked_contacts FOR INSERT
WITH CHECK (connection_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can delete their own blocked contacts"
ON public.blocked_contacts FOR DELETE
USING (connection_user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Update get_chat_contacts function to filter blocked contacts
CREATE OR REPLACE FUNCTION public.get_chat_contacts()
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
  active_chat_provider chat_provider
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_tenant_id uuid;
  current_user_id uuid;
BEGIN
  current_tenant_id := get_user_tenant_id(auth.uid());
  current_user_id := auth.uid();
  
  IF current_tenant_id IS NULL OR current_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Clients (only non-blocked)
  SELECT 
    c.id as contact_id,
    'client'::text as contact_type,
    c.name,
    c.contact_name,
    c.phone,
    c.email,
    c.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.client_id = c.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.client_id = c.id 
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    c.manychat_subscriber_id,
    c.active_chat_provider
  FROM clients c
  JOIN agencies a ON c.agency_id = a.id
  WHERE c.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.client_id = c.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.client_id = c.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  UNION ALL

  -- Leads (only non-blocked)
  SELECT 
    l.id as contact_id,
    'lead'::text as contact_type,
    l.company_name as name,
    l.contact_name,
    l.phone,
    l.email,
    l.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.lead_id = l.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.lead_id = l.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    l.manychat_subscriber_id,
    l.active_chat_provider
  FROM leads l
  LEFT JOIN agencies a ON l.agency_id = a.id
  WHERE l.tenant_id = current_tenant_id
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.lead_id = l.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.lead_id = l.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  UNION ALL

  -- Groups (only non-blocked)
  SELECT 
    g.id as contact_id,
    'group'::text as contact_type,
    g.group_name as name,
    NULL::text as contact_name,
    NULL::text as phone,
    NULL::text as email,
    g.agency_id,
    a.name as agency_name,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM chat_messages cm 
       WHERE cm.group_id = g.id 
       AND cm.direction = 'incoming' 
       AND cm.read_at IS NULL
       AND cm.is_blocked = false
       AND cm.connection_user_id = current_user_id),
      0
    ) as unread_count,
    (SELECT MAX(created_at) 
     FROM chat_messages cm 
     WHERE cm.group_id = g.id
     AND cm.connection_user_id = current_user_id) as last_message_at,
    false as is_blocked,
    NULL::text as manychat_subscriber_id,
    NULL::chat_provider as active_chat_provider
  FROM whatsapp_groups g
  LEFT JOIN agencies a ON g.agency_id = a.id
  WHERE g.tenant_id = current_tenant_id
  AND g.is_blocked = false
  AND EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.group_id = g.id
    AND cm.connection_user_id = current_user_id
    AND cm.is_blocked = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocked_contacts bc
    WHERE bc.group_id = g.id
    AND bc.connection_user_id = current_user_id
    AND bc.tenant_id = current_tenant_id
  )

  ORDER BY last_message_at DESC NULLS LAST;
END;
$function$;

-- Update get_unknown_chat_contacts to filter blocked contacts
CREATE OR REPLACE FUNCTION public.get_unknown_chat_contacts()
RETURNS TABLE(
  id text, 
  name text, 
  sender_phone text, 
  contact_type text, 
  last_message_at timestamp with time zone, 
  unread_count bigint, 
  is_blocked boolean, 
  agency_id uuid, 
  agency_name text, 
  wid text
)
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
  )
  SELECT 
    pc.phone::TEXT as id,
    COALESCE(inb.sender_name, pc.phone) as name,
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
$function$;