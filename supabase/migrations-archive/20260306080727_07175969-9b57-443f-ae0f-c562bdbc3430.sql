
-- Drop the function that was created with wrong order
DROP FUNCTION IF EXISTS public.is_channel_member(uuid, uuid);

-- Create tables first
CREATE TABLE public.team_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  avatar_url text,
  created_by uuid NOT NULL,
  is_private boolean DEFAULT false,
  linked_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  linked_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE public.team_channel_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  parent_message_id uuid REFERENCES public.team_messages(id) ON DELETE SET NULL,
  is_edited boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  linked_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  linked_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
ALTER TABLE public.team_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_message_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_message_id uuid REFERENCES public.team_messages(id) ON DELETE SET NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE public.team_message_read_status ENABLE ROW LEVEL SECURITY;

-- Now create the security definer function
CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  )
$$;

-- RLS Policies for team_channels
CREATE POLICY "Members can view their channels" ON public.team_channels
  FOR SELECT TO authenticated
  USING (is_channel_member(id, auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can create channels" ON public.team_channels
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Channel admins can update" ON public.team_channels
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM team_channel_members WHERE channel_id = id AND user_id = auth.uid() AND role = 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Channel admins can delete" ON public.team_channels
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_super_admin(auth.uid()));

-- RLS for team_channel_members
CREATE POLICY "Members can view channel members" ON public.team_channel_members
  FOR SELECT TO authenticated
  USING (is_channel_member(channel_id, auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins or creators can add members" ON public.team_channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM team_channel_members tcm2 WHERE tcm2.channel_id = channel_id AND tcm2.user_id = auth.uid() AND tcm2.role = 'admin')
    OR NOT EXISTS (SELECT 1 FROM team_channel_members tcm3 WHERE tcm3.channel_id = channel_id)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can remove members" ON public.team_channel_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM team_channel_members tcm2 WHERE tcm2.channel_id = channel_id AND tcm2.user_id = auth.uid() AND tcm2.role = 'admin')
    OR user_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

-- RLS for team_messages
CREATE POLICY "Members can view messages" ON public.team_messages
  FOR SELECT TO authenticated
  USING (is_channel_member(channel_id, auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Members can send messages" ON public.team_messages
  FOR INSERT TO authenticated
  WITH CHECK (is_channel_member(channel_id, auth.uid()) AND sender_id = auth.uid());

CREATE POLICY "Senders can edit messages" ON public.team_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete messages" ON public.team_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR is_super_admin(auth.uid()));

-- RLS for team_message_attachments
CREATE POLICY "Members can view attachments" ON public.team_message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_messages tm WHERE tm.id = message_id AND is_channel_member(tm.channel_id, auth.uid())));

CREATE POLICY "Members can add attachments" ON public.team_message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM team_messages tm WHERE tm.id = message_id AND tm.sender_id = auth.uid()));

-- RLS for team_message_reactions
CREATE POLICY "Members can view reactions" ON public.team_message_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_messages tm WHERE tm.id = message_id AND is_channel_member(tm.channel_id, auth.uid())));

CREATE POLICY "Members can add reactions" ON public.team_message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM team_messages tm WHERE tm.id = message_id AND is_channel_member(tm.channel_id, auth.uid())));

CREATE POLICY "Users can remove own reactions" ON public.team_message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS for team_message_read_status
CREATE POLICY "Users can view own read status" ON public.team_message_read_status
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own read status" ON public.team_message_read_status
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own read status" ON public.team_message_read_status
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('team-attachments', 'team-attachments', true);

CREATE POLICY "Authenticated users can upload team attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-attachments');

CREATE POLICY "Anyone can view team attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'team-attachments');
