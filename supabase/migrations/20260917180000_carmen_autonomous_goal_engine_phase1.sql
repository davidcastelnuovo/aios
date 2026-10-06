-- Carmen Autonomous Goal Engine — Phase 1: Goal Contract, loop persistence, worker scheduling.
-- Extends goals (coexists with execution_mode). See docs/carmen-autonomous-goal-engine.md

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS autonomous_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS engine_status text NOT NULL DEFAULT 'PLANNING'
    CHECK (engine_status IN ('PLANNING', 'EXECUTING', 'VERIFYING', 'REPLANNING', 'BLOCKED', 'COMPLETED')),
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'READ'
    CHECK (risk_level IN ('READ', 'SAFE_WRITE', 'REVERSIBLE', 'PRODUCTION', 'DESTRUCTIVE')),
  ADD COLUMN IF NOT EXISTS plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_iteration_at timestamptz,
  ADD COLUMN IF NOT EXISTS iteration_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stuck_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS lock_holder text;

COMMENT ON COLUMN public.goals.autonomous_mode IS
  'When true, autonomous-goal-worker runs the server-side loop until Completion Gate passes.';
COMMENT ON COLUMN public.goals.engine_status IS
  'Autonomous engine state machine: PLANNING → EXECUTING → VERIFYING → COMPLETED | BLOCKED | REPLANNING';

CREATE INDEX IF NOT EXISTS idx_goals_autonomous_due
  ON public.goals (next_run_at)
  WHERE autonomous_mode = true AND engine_status NOT IN ('COMPLETED', 'BLOCKED');

-- Structured success criteria (Completion Gate source of truth)
CREATE TABLE IF NOT EXISTS public.goal_success_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  criterion_key text NOT NULL,
  description text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  verification_type text NOT NULL DEFAULT 'manual'
    CHECK (verification_type IN ('manual', 'http_check', 'sql_assert', 'test_pass', 'cursor_evidence', 'metric')),
  verification_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_required text,
  status text NOT NULL DEFAULT 'NOT_TESTED'
    CHECK (status IN ('PASS', 'FAIL', 'UNKNOWN', 'NOT_TESTED')),
  last_verified_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_goal_success_criteria_goal
  ON public.goal_success_criteria (goal_id, sort_order);

-- One row per worker iteration
CREATE TABLE IF NOT EXISTS public.goal_loop_iterations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  iteration_number integer NOT NULL,
  phase text NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  summary text,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_goal_loop_iterations_goal
  ON public.goal_loop_iterations (goal_id, iteration_number DESC);

-- Plan steps / sub-goals within a goal
CREATE TABLE IF NOT EXISTS public.goal_plan_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  parent_step_id uuid REFERENCES public.goal_plan_steps(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  action_type text NOT NULL DEFAULT 'model'
    CHECK (action_type IN ('model', 'tool', 'cursor', 'verify', 'observe')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done', 'failed', 'skipped', 'blocked')),
  priority integer NOT NULL DEFAULT 5,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_plan_steps_goal
  ON public.goal_plan_steps (goal_id, status, sort_order);

-- Every action the engine executes
CREATE TABLE IF NOT EXISTS public.goal_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  iteration_id uuid REFERENCES public.goal_loop_iterations(id) ON DELETE SET NULL,
  step_id uuid REFERENCES public.goal_plan_steps(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  tool_name text,
  input_hash text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_goal_actions_goal
  ON public.goal_actions (goal_id, started_at DESC);

-- Evidence per criterion (Verifier input)
CREATE TABLE IF NOT EXISTS public.goal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  criterion_id uuid REFERENCES public.goal_success_criteria(id) ON DELETE SET NULL,
  evidence_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_action_id uuid REFERENCES public.goal_actions(id) ON DELETE SET NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_evidence_goal
  ON public.goal_evidence (goal_id, verified_at DESC);

-- Model router audit (Phase 3 foundation)
CREATE TABLE IF NOT EXISTS public.goal_model_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  iteration_id uuid REFERENCES public.goal_loop_iterations(id) ON DELETE SET NULL,
  profile text NOT NULL,
  provider text,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10, 6),
  latency_ms integer,
  error_class text,
  failover_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_model_events_goal
  ON public.goal_model_events (goal_id, created_at DESC);

-- Per-tenant / per-goal tool registry (Phase 5 foundation)
CREATE TABLE IF NOT EXISTS public.goal_engine_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.goals(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  handler_ref text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, goal_id, name)
);

-- Extend goal_blockers for autonomous human gates
ALTER TABLE public.goal_blockers
  ADD COLUMN IF NOT EXISTS blocker_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS requires_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_action_required text;

-- RLS
ALTER TABLE public.goal_success_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_loop_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_plan_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_model_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_engine_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY goal_success_criteria_tenant_rw ON public.goal_success_criteria
  FOR ALL USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY goal_loop_iterations_tenant_read ON public.goal_loop_iterations
  FOR SELECT USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY goal_plan_steps_tenant_rw ON public.goal_plan_steps
  FOR ALL USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY goal_actions_tenant_read ON public.goal_actions
  FOR SELECT USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY goal_evidence_tenant_read ON public.goal_evidence
  FOR SELECT USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY goal_model_events_tenant_read ON public.goal_model_events
  FOR SELECT USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY goal_engine_tools_tenant_rw ON public.goal_engine_tools
  FOR ALL USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

-- Worker cron (every minute)
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'autonomous-goal-worker';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'autonomous-goal-worker',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/autonomous-goal-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'task_worker_anon_key'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
    $cron$
  );
END;
$$;
