
-- =====================================================
-- PHASE A: Memory layers, Tool Registry, Approval Gate, Cost tracking
-- =====================================================

-- 1) Memory layers on agent_memory
DO $$ BEGIN
  CREATE TYPE public.agent_memory_layer AS ENUM ('working','episodic','semantic','user_model');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS memory_type public.agent_memory_layer NOT NULL DEFAULT 'semantic',
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS fts tsvector;

-- backfill fts from title+summary
UPDATE public.agent_memory
SET fts = to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,''))
WHERE fts IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_memory_fts ON public.agent_memory USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON public.agent_memory(agent_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_contact ON public.agent_memory(agent_id, contact_phone) WHERE contact_phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.agent_memory_fts_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.fts := to_tsvector('simple', coalesce(NEW.title,'') || ' ' || coalesce(NEW.summary,''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_agent_memory_fts ON public.agent_memory;
CREATE TRIGGER trg_agent_memory_fts BEFORE INSERT OR UPDATE OF title, summary
  ON public.agent_memory FOR EACH ROW EXECUTE FUNCTION public.agent_memory_fts_update();

-- 2) Per-contact user-model profile
CREATE TABLE IF NOT EXISTS public.agent_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  display_name TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, contact_phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_user_profiles TO authenticated;
GRANT ALL ON public.agent_user_profiles TO service_role;
ALTER TABLE public.agent_user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aup_tenant_select" ON public.agent_user_profiles FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "aup_tenant_modify" ON public.agent_user_profiles FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- 3) Tool Registry
CREATE TABLE IF NOT EXISTS public.agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,                            -- NULL = global built-in
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',  -- crm, ads, social, comms, code, general, mcp
  description TEXT,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  handler_kind TEXT NOT NULL DEFAULT 'edge', -- 'edge' | 'mcp' | 'internal'
  handler_ref TEXT,                          -- edge function name or MCP server id
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT ON public.agent_tools TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.agent_tools TO authenticated;
GRANT ALL ON public.agent_tools TO service_role;
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tools_read" ON public.agent_tools FOR SELECT
  USING (tenant_id IS NULL OR tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "tools_write" ON public.agent_tools FOR ALL
  USING (tenant_id IS NOT NULL AND tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IS NOT NULL AND tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- 4) Generic approval queue (create if not exists; otherwise widen)
CREATE TABLE IF NOT EXISTS public.agent_approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  requested_by UUID,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  context JSONB,
  proposed_changes JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_approval_queue
  ADD COLUMN IF NOT EXISTS tool_name TEXT,
  ADD COLUMN IF NOT EXISTS tool_input JSONB,
  ADD COLUMN IF NOT EXISTS run_id UUID,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_approval_queue TO authenticated;
GRANT ALL ON public.agent_approval_queue TO service_role;
ALTER TABLE public.agent_approval_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "approval_select" ON public.agent_approval_queue FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "approval_insert" ON public.agent_approval_queue FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "approval_update" ON public.agent_approval_queue FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_approval_pending ON public.agent_approval_queue(tenant_id, status, created_at DESC);

-- 5) Action log + cost tracking
CREATE TABLE IF NOT EXISTS public.agent_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  user_id UUID,
  conversation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_action_log
  ADD COLUMN IF NOT EXISTS tokens_in INTEGER,
  ADD COLUMN IF NOT EXISTS tokens_out INTEGER,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS tool_calls INTEGER,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS run_id UUID;

GRANT SELECT, INSERT ON public.agent_action_log TO authenticated;
GRANT ALL ON public.agent_action_log TO service_role;
ALTER TABLE public.agent_action_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "action_log_select" ON public.agent_action_log FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "action_log_insert" ON public.agent_action_log FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_action_log_tenant_time ON public.agent_action_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_run ON public.agent_action_log(run_id);

-- 6) updated_at trigger reuse
DO $$ BEGIN
  CREATE TRIGGER trg_aup_updated_at BEFORE UPDATE ON public.agent_user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tools_updated_at BEFORE UPDATE ON public.agent_tools
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
