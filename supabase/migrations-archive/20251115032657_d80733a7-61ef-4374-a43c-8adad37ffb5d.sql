-- Add manychat_subscriber_id to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS manychat_subscriber_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_manychat_subscriber ON clients(manychat_subscriber_id);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_text TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp',
  sent_by_user_id UUID REFERENCES auth.users(id),
  raw_provider_data JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_client ON chat_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_messages
CREATE POLICY "Users can view chat_messages in their tenant"
  ON chat_messages FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can view chat_messages from shared agencies"
  ON chat_messages FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = chat_messages.client_id
      AND user_has_cross_tenant_agency_access(auth.uid(), c.agency_id)
    )
  );

CREATE POLICY "Users can insert chat_messages in their tenant"
  ON chat_messages FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update chat_messages in their tenant"
  ON chat_messages FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage chat_messages with permission"
  ON chat_messages FOR ALL
  USING (
    is_super_admin(auth.uid()) AND
    (SELECT allow_super_admin_access FROM tenants WHERE id = chat_messages.tenant_id) = true
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_messages_updated_at();