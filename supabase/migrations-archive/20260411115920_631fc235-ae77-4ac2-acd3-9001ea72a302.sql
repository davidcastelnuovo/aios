
-- Telegram bot state per tenant (singleton per tenant)
CREATE TABLE public.telegram_bot_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  update_offset bigint NOT NULL DEFAULT 0,
  bot_username text,
  bot_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view telegram bot state in their tenant"
ON public.telegram_bot_state FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Owners can manage telegram bot state"
ON public.telegram_bot_state FOR ALL TO authenticated
USING (
  (has_role(auth.uid(), 'owner'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- Telegram messages table
CREATE TABLE public.telegram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  update_id bigint,
  chat_id bigint NOT NULL,
  text text,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  sender_name text,
  sender_username text,
  raw_update jsonb,
  client_id uuid REFERENCES public.clients(id),
  lead_id uuid REFERENCES public.leads(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, update_id)
);

CREATE INDEX idx_telegram_messages_tenant_chat ON public.telegram_messages(tenant_id, chat_id);
CREATE INDEX idx_telegram_messages_created ON public.telegram_messages(created_at DESC);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view telegram messages in their tenant"
ON public.telegram_messages FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert telegram messages in their tenant"
ON public.telegram_messages FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
);

-- Enable realtime for telegram_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_messages;
