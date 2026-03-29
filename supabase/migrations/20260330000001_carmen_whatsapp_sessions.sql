-- Carmen WhatsApp Sessions table
-- Tracks active Carmen AI conversations initiated via WhatsApp keyword trigger

CREATE TABLE IF NOT EXISTS carmen_whatsapp_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  chat_id TEXT NOT NULL,
  phone TEXT,
  sender_name TEXT,
  agent_id UUID,
  connection_user_id TEXT,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_by_keyword TEXT DEFAULT 'כרמן',
  end_keyword TEXT DEFAULT 'סיימנו כרמן',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_carmen_sessions_lookup 
  ON carmen_whatsapp_sessions(tenant_id, chat_id, status);

CREATE INDEX IF NOT EXISTS idx_carmen_sessions_last_message
  ON carmen_whatsapp_sessions(last_message_at);

ALTER TABLE carmen_whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation_carmen_sessions" ON carmen_whatsapp_sessions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_active_tenant 
      WHERE user_id = auth.uid()
    )
  );
