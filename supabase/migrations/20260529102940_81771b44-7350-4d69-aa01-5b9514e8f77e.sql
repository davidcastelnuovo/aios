
-- agent_runs: representation of an autonomous agent execution
CREATE TABLE public.agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  user_id UUID,
  goal TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','waiting_approval','completed','failed','cancelled')),
  current_step INTEGER NOT NULL DEFAULT 0,
  max_steps INTEGER NOT NULL DEFAULT 12,
  final_answer TEXT,
  error_message TEXT,
  pending_approval_id UUID,
  model TEXT,
  total_tokens_in INTEGER NOT NULL DEFAULT 0,
  total_tokens_out INTEGER NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  conversation_id UUID,
  trigger_source TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_runs_tenant_status ON public.agent_runs (tenant_id, status, started_at DESC);
CREATE INDEX idx_agent_runs_agent ON public.agent_runs (agent_id, started_at DESC);
CREATE INDEX idx_agent_runs_approval ON public.agent_runs (pending_approval_id) WHERE pending_approval_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view runs"
ON public.agent_runs FOR SELECT TO authenticated
USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant members can insert runs"
ON public.agent_runs FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_effective_tenant_id());

CREATE POLICY "Tenant members can update their runs"
ON public.agent_runs FOR UPDATE TO authenticated
USING (tenant_id = public.get_effective_tenant_id());

CREATE TRIGGER trg_agent_runs_updated_at
BEFORE UPDATE ON public.agent_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step trace columns on agent_action_log
ALTER TABLE public.agent_action_log
  ADD COLUMN IF NOT EXISTS step_index INTEGER,
  ADD COLUMN IF NOT EXISTS step_kind TEXT,
  ADD COLUMN IF NOT EXISTS thought TEXT,
  ADD COLUMN IF NOT EXISTS observation JSONB;

CREATE INDEX IF NOT EXISTS idx_agent_action_log_run_step
  ON public.agent_action_log (run_id, step_index)
  WHERE run_id IS NOT NULL;
