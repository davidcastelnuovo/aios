-- Agent brain channels: routing layer for Command Center Direct / Parliament.
-- Additive. Does not change how run-ai-agent or ai_agents.engine work.

-- ---------------------------------------------------------------------------
-- Columns on existing tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS brain_mode text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS brain_route_id uuid;

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS agent_id uuid,
  ADD COLUMN IF NOT EXISTS brain_route_id uuid,
  ADD COLUMN IF NOT EXISTS routing_mode text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle';

CREATE INDEX IF NOT EXISTS idx_ai_conversations_brain_route
  ON public.ai_conversations (tenant_id, brain_route_id)
  WHERE brain_route_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- agent_brain_routes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_brain_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid,
  slug text NOT NULL,
  label text NOT NULL,
  route_type text NOT NULL DEFAULT 'internal',
  provider text,
  connection_id uuid,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_agent_brain_routes_tenant_active
  ON public.agent_brain_routes (tenant_id, active);

ALTER TABLE public.agent_brain_routes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.agent_brain_routes TO authenticated;
GRANT ALL ON public.agent_brain_routes TO service_role;

DROP POLICY IF EXISTS "Tenant members can view brain routes" ON public.agent_brain_routes;
CREATE POLICY "Tenant members can view brain routes"
  ON public.agent_brain_routes FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant members can insert brain routes" ON public.agent_brain_routes;
CREATE POLICY "Tenant members can insert brain routes"
  ON public.agent_brain_routes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant members can update brain routes" ON public.agent_brain_routes;
CREATE POLICY "Tenant members can update brain routes"
  ON public.agent_brain_routes FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- agent_channel_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_channel_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  brain_route_id uuid,
  provider text NOT NULL,
  external_session_id text,
  external_run_id text,
  external_url text,
  conversation_key text,
  status text NOT NULL DEFAULT 'running',
  parliament_run_id uuid,
  parliament_round integer,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_channel_sessions_conversation
  ON public.agent_channel_sessions (conversation_id, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_channel_sessions_tenant_status
  ON public.agent_channel_sessions (tenant_id, status, last_activity_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS agent_channel_sessions_one_running_per_provider
  ON public.agent_channel_sessions (conversation_id, provider)
  WHERE status IN ('running', 'waiting');

ALTER TABLE public.agent_channel_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.agent_channel_sessions TO authenticated;
GRANT ALL ON public.agent_channel_sessions TO service_role;

DROP POLICY IF EXISTS "Tenant members can view channel sessions" ON public.agent_channel_sessions;
CREATE POLICY "Tenant members can view channel sessions"
  ON public.agent_channel_sessions FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant members can insert channel sessions" ON public.agent_channel_sessions;
CREATE POLICY "Tenant members can insert channel sessions"
  ON public.agent_channel_sessions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant members can update channel sessions" ON public.agent_channel_sessions;
CREATE POLICY "Tenant members can update channel sessions"
  ON public.agent_channel_sessions FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- ai_conversation_messages (normalized events; jsonb on ai_conversations remains)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  role text NOT NULL,
  speaker text,
  channel text,
  content text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT 'message',
  external_message_id text,
  correlation_id uuid,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_messages_conv
  ON public.ai_conversation_messages (conversation_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS ai_conversation_messages_idempotency
  ON public.ai_conversation_messages (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_conversation_messages_external
  ON public.ai_conversation_messages (tenant_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

ALTER TABLE public.ai_conversation_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.ai_conversation_messages TO authenticated;
GRANT ALL ON public.ai_conversation_messages TO service_role;

DROP POLICY IF EXISTS "Tenant members can view conversation messages" ON public.ai_conversation_messages;
CREATE POLICY "Tenant members can view conversation messages"
  ON public.ai_conversation_messages FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant members can insert conversation messages" ON public.ai_conversation_messages;
CREATE POLICY "Tenant members can insert conversation messages"
  ON public.ai_conversation_messages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- FKs (added after tables exist so IF NOT EXISTS stays safe)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_agents_brain_route_id_fkey'
  ) THEN
    ALTER TABLE public.ai_agents
      ADD CONSTRAINT ai_agents_brain_route_id_fkey
      FOREIGN KEY (brain_route_id) REFERENCES public.agent_brain_routes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversations_brain_route_id_fkey'
  ) THEN
    ALTER TABLE public.ai_conversations
      ADD CONSTRAINT ai_conversations_brain_route_id_fkey
      FOREIGN KEY (brain_route_id) REFERENCES public.agent_brain_routes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_channel_sessions_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.agent_channel_sessions
      ADD CONSTRAINT agent_channel_sessions_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversation_messages_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.ai_conversation_messages
      ADD CONSTRAINT ai_conversation_messages_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_agent_brain_routes_updated_at ON public.agent_brain_routes;
CREATE TRIGGER trg_agent_brain_routes_updated_at
  BEFORE UPDATE ON public.agent_brain_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_agent_channel_sessions_updated_at ON public.agent_channel_sessions;
CREATE TRIGGER trg_agent_channel_sessions_updated_at
  BEFORE UPDATE ON public.agent_channel_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_conversation_messages REPLICA IDENTITY FULL;
ALTER TABLE public.ai_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.agent_channel_sessions REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_conversation_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_channel_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_object THEN NULL;
END $$;
