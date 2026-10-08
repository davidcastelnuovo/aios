-- Dev Task Command Center: structured development tasks routed to Cursor/Grok/Manus.

CREATE TABLE IF NOT EXISTS public.dev_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  problem text,
  expected_behavior text,
  current_behavior text,
  scope text,
  affected_areas text,
  constraints text,
  acceptance_criteria text,
  base_branch text NOT NULL DEFAULT 'develop',
  environment text NOT NULL DEFAULT 'staging',
  requested_by text,
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'approved', 'sent_to_cursor', 'in_progress', 'blocked',
      'pr_opened', 'ready_for_review', 'done', 'cancelled'
    )),
  assigned_agent text NOT NULL DEFAULT 'cursor'
    CHECK (assigned_agent IN ('cursor', 'grok', 'manus', 'claude')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_conversation_id uuid,
  source_message text,
  cursor_session_id text,
  cursor_session_url text,
  pr_url text,
  human_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  dedup_of uuid REFERENCES public.dev_tasks(id) ON DELETE SET NULL,
  dispatch_error text,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  dispatched_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dev_tasks IS
  'Structured dev/system-fix tasks from Carmen → coding agents. No concurrency caps — manage by status, priority, dedup, and links.';

CREATE INDEX IF NOT EXISTS idx_dev_tasks_tenant_status
  ON public.dev_tasks(tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_dev_tasks_tenant_title
  ON public.dev_tasks(tenant_id, lower(title));

CREATE TABLE IF NOT EXISTS public.dev_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dev_task_id uuid NOT NULL REFERENCES public.dev_tasks(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_task_events_task
  ON public.dev_task_events(dev_task_id, created_at DESC);

ALTER TABLE public.cursor_task_sessions
  ADD COLUMN IF NOT EXISTS dev_task_id uuid REFERENCES public.dev_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cursor_task_sessions_dev_task
  ON public.cursor_task_sessions(dev_task_id)
  WHERE dev_task_id IS NOT NULL;

ALTER TABLE public.dev_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_task_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY dev_tasks_tenant_rw ON public.dev_tasks
  FOR ALL
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY dev_task_events_tenant_read ON public.dev_task_events
  FOR SELECT
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );
