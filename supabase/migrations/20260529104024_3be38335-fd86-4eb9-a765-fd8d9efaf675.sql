
CREATE TABLE public.agent_supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  supervisor_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  child_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  routing_hint TEXT,
  priority INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supervisor_agent_id, child_agent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_supervisors TO authenticated;
GRANT ALL ON public.agent_supervisors TO service_role;
ALTER TABLE public.agent_supervisors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read supervisors" ON public.agent_supervisors FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "tenant manage supervisors" ON public.agent_supervisors FOR ALL TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_agent_supervisors_supervisor ON public.agent_supervisors(supervisor_agent_id);
CREATE INDEX idx_agent_supervisors_tenant ON public.agent_supervisors(tenant_id);

CREATE TABLE public.agent_mcp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  transport TEXT NOT NULL DEFAULT 'http',
  state TEXT NOT NULL DEFAULT 'ready',
  auth_url TEXT,
  oauth_tokens JSONB,
  client_metadata JSONB,
  available_tools JSONB DEFAULT '[]'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_mcp_connections TO authenticated;
GRANT ALL ON public.agent_mcp_connections TO service_role;
ALTER TABLE public.agent_mcp_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read mcp" ON public.agent_mcp_connections FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "tenant manage mcp" ON public.agent_mcp_connections FOR ALL TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_mcp_conn_tenant ON public.agent_mcp_connections(tenant_id);
CREATE INDEX idx_mcp_conn_agent ON public.agent_mcp_connections(agent_id);
CREATE TRIGGER trg_mcp_conn_updated BEFORE UPDATE ON public.agent_mcp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_evals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  dataset JSONB NOT NULL DEFAULT '[]'::jsonb,
  pass_threshold INT NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_evals TO authenticated;
GRANT ALL ON public.agent_evals TO service_role;
ALTER TABLE public.agent_evals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read evals" ON public.agent_evals FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "tenant manage evals" ON public.agent_evals FOR ALL TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_evals_agent ON public.agent_evals(agent_id);
CREATE TRIGGER trg_agent_evals_updated BEFORE UPDATE ON public.agent_evals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  eval_id UUID NOT NULL REFERENCES public.agent_evals(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  total_cases INT NOT NULL DEFAULT 0,
  passed_cases INT NOT NULL DEFAULT 0,
  avg_score NUMERIC(5,2),
  results JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_eval_runs TO authenticated;
GRANT ALL ON public.agent_eval_runs TO service_role;
ALTER TABLE public.agent_eval_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read eval_runs" ON public.agent_eval_runs FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "tenant manage eval_runs" ON public.agent_eval_runs FOR ALL TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_eval_runs_eval ON public.agent_eval_runs(eval_id);

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegated_to_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replay_of_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agent_runs_parent ON public.agent_runs(parent_run_id);
