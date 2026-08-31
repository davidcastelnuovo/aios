-- Goal Execution Mode for Carmen Command Center — extends goals + milestones/blockers/audit.
-- Links to tasks, dev_tasks, agent_tasks. No Cursor concurrency caps.

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_status_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_status_check
  CHECK (status IN ('active', 'in_progress', 'blocked', 'completed', 'cancelled', 'paused'));

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS completion_criteria text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.goals.execution_mode IS
  'When true, goal is managed via Command Center execution workflow (milestones, blockers, Carmen).';

CREATE TABLE IF NOT EXISTS public.goal_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  sort_order integer NOT NULL DEFAULT 0,
  due_date date,
  owner_id text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal
  ON public.goal_milestones(goal_id, sort_order);

CREATE TABLE IF NOT EXISTS public.goal_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_blockers_goal
  ON public.goal_blockers(goal_id, status);

CREATE TABLE IF NOT EXISTS public.goal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_events_goal
  ON public.goal_events(goal_id, created_at DESC);

ALTER TABLE public.dev_tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dev_tasks_goal
  ON public.dev_tasks(goal_id) WHERE goal_id IS NOT NULL;

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_goal
  ON public.agent_tasks(goal_id) WHERE goal_id IS NOT NULL;

ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY goal_milestones_tenant_rw ON public.goal_milestones
  FOR ALL USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY goal_blockers_tenant_rw ON public.goal_blockers
  FOR ALL USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY goal_events_tenant_read ON public.goal_events
  FOR SELECT USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );
