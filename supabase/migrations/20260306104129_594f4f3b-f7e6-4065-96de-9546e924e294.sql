
-- Table to link WhatsApp chats/groups to team channels
CREATE TABLE public.team_channel_whatsapp_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Link to a WhatsApp group
  whatsapp_group_id uuid REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  -- Or link to a specific chat by chatId (e.g. 972501234567@c.us or group@g.us)
  whatsapp_chat_id text,
  -- Optional: link to client/lead for context
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  -- Display name for the link
  display_name text,
  -- Whether to forward files as attachments
  forward_files boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  UNIQUE(channel_id, whatsapp_group_id),
  UNIQUE(channel_id, whatsapp_chat_id)
);

ALTER TABLE public.team_channel_whatsapp_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view links in their tenant" ON public.team_channel_whatsapp_links
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage links in their tenant" ON public.team_channel_whatsapp_links
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
