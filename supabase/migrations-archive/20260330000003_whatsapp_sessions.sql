-- Clean WhatsApp session table for conversation continuity
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  chat_id TEXT NOT NULL,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_lookup
  ON whatsapp_sessions(tenant_id, chat_id, status);

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for Edge Functions)
CREATE POLICY "service_role_all" ON whatsapp_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
