
-- Table for hiding chats from view (without deleting history)
CREATE TABLE public.hidden_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  sender_phone TEXT,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hidden_chats_contact_check CHECK (
    (client_id IS NOT NULL)::int + 
    (lead_id IS NOT NULL)::int + 
    (group_id IS NOT NULL)::int + 
    (sender_phone IS NOT NULL)::int = 1
  )
);

-- Enable RLS
ALTER TABLE public.hidden_chats ENABLE ROW LEVEL SECURITY;

-- RLS policies for hidden_chats
CREATE POLICY "Users can view their own hidden chats"
ON public.hidden_chats FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own hidden chats"
ON public.hidden_chats FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own hidden chats"
ON public.hidden_chats FOR DELETE
USING (user_id = auth.uid());

-- Table for chat tags (tag definitions per tenant)
CREATE TABLE public.chat_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.chat_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_tags
CREATE POLICY "Users can view tags in their tenant"
ON public.chat_tags FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Owners can manage tags in their tenant"
ON public.chat_tags FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
);

-- Allow all users to manage tags (not just owners)
CREATE POLICY "Users can manage tags in their tenant"
ON public.chat_tags FOR ALL
USING (tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Table for linking tags to chat contacts
CREATE TABLE public.chat_contact_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES public.chat_tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  sender_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_contact_tags_contact_check CHECK (
    (client_id IS NOT NULL)::int + 
    (lead_id IS NOT NULL)::int + 
    (group_id IS NOT NULL)::int + 
    (sender_phone IS NOT NULL)::int = 1
  ),
  UNIQUE(tag_id, client_id),
  UNIQUE(tag_id, lead_id),
  UNIQUE(tag_id, group_id),
  UNIQUE(tag_id, sender_phone)
);

-- Enable RLS
ALTER TABLE public.chat_contact_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_contact_tags
CREATE POLICY "Users can view their own contact tags"
ON public.chat_contact_tags FOR SELECT
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can manage their own contact tags"
ON public.chat_contact_tags FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_hidden_chats_user_tenant ON public.hidden_chats(user_id, tenant_id);
CREATE INDEX idx_hidden_chats_client ON public.hidden_chats(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_hidden_chats_lead ON public.hidden_chats(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_hidden_chats_group ON public.hidden_chats(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_hidden_chats_phone ON public.hidden_chats(sender_phone) WHERE sender_phone IS NOT NULL;

CREATE INDEX idx_chat_tags_tenant ON public.chat_tags(tenant_id);
CREATE INDEX idx_chat_contact_tags_tag ON public.chat_contact_tags(tag_id);
CREATE INDEX idx_chat_contact_tags_user ON public.chat_contact_tags(user_id, tenant_id);
