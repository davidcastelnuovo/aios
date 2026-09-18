-- Goal Engine orchestration brain via Carmen Direct ↔ Cursor Direct sticky chat.
-- Async requests + callback; avoids Model API for planning/management.

-- Tenant-level pinned Cursor Direct session for goal orchestration (memory).
CREATE TABLE IF NOT EXISTS public.goal_orchestrator_brain (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  cursor_session_id text NOT NULL,
  cursor_session_url text,
  session_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.goal_orchestrator_brain IS
  'Sticky Cursor Direct session (bc-…) used as the autonomous goal engine orchestration brain per tenant.';

ALTER TABLE public.goal_orchestrator_brain ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.goal_orchestrator_brain TO authenticated;
GRANT ALL ON public.goal_orchestrator_brain TO service_role;

DROP POLICY IF EXISTS goal_orchestrator_brain_tenant_read ON public.goal_orchestrator_brain;
CREATE POLICY goal_orchestrator_brain_tenant_read ON public.goal_orchestrator_brain
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Async brain requests (plan, step reasoning, efficiency review).
CREATE TABLE IF NOT EXISTS public.goal_brain_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  iteration_id uuid REFERENCES public.goal_loop_iterations(id) ON DELETE SET NULL,
  step_id uuid REFERENCES public.goal_plan_steps(id) ON DELETE SET NULL,
  action_id uuid REFERENCES public.goal_actions(id) ON DELETE SET NULL,
  request_type text NOT NULL
    CHECK (request_type IN ('plan', 'step_execute', 'efficiency_review')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'completed', 'failed', 'busy')),
  cursor_session_id text,
  prompt_summary text,
  response_json jsonb,
  error_message text,
  callback_token text,
  delivered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_brain_requests_goal_status
  ON public.goal_brain_requests (goal_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_brain_requests_inflight
  ON public.goal_brain_requests (goal_id, request_type)
  WHERE status IN ('pending', 'sent', 'busy');

COMMENT ON TABLE public.goal_brain_requests IS
  'Async orchestration requests sent to Cursor Direct; completed via goal-brain-callback.';

ALTER TABLE public.goal_brain_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.goal_brain_requests TO authenticated;
GRANT ALL ON public.goal_brain_requests TO service_role;

DROP POLICY IF EXISTS goal_brain_requests_tenant_read ON public.goal_brain_requests;
CREATE POLICY goal_brain_requests_tenant_read ON public.goal_brain_requests
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Allow AWAITING_BRAIN engine status while Cursor Direct processes orchestration.
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_engine_status_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_engine_status_check
  CHECK (engine_status IN (
    'PLANNING', 'EXECUTING', 'VERIFYING', 'REPLANNING', 'BLOCKED', 'COMPLETED', 'AWAITING_BRAIN'
  ));

COMMENT ON COLUMN public.goals.engine_status IS
  'Autonomous engine state machine. AWAITING_BRAIN = waiting on Cursor Direct orchestrator reply.';

DROP TRIGGER IF EXISTS trg_goal_orchestrator_brain_updated_at ON public.goal_orchestrator_brain;
CREATE TRIGGER trg_goal_orchestrator_brain_updated_at
  BEFORE UPDATE ON public.goal_orchestrator_brain
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_goal_brain_requests_updated_at ON public.goal_brain_requests;
CREATE TRIGGER trg_goal_brain_requests_updated_at
  BEFORE UPDATE ON public.goal_brain_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
