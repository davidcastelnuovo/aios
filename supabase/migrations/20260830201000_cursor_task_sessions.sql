-- Track Cursor Cloud Agent sessions (bc-…) per human task / dispatch — no fixed session ids.

CREATE TABLE IF NOT EXISTS public.cursor_task_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  cursor_agent_id text NOT NULL,
  session_url text,
  display_name text NOT NULL,
  human_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_title text,
  source_tool text NOT NULL,
  app_env text,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'busy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cursor_task_sessions IS
  'Maps Cursor Cloud Agent bc-… sessions to AIOS tasks. Replaces reliance on a single fixed direct chat.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cursor_task_sessions_agent
  ON public.cursor_task_sessions(cursor_agent_id);

CREATE INDEX IF NOT EXISTS idx_cursor_task_sessions_tenant_status
  ON public.cursor_task_sessions(tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cursor_task_sessions_task
  ON public.cursor_task_sessions(human_task_id)
  WHERE human_task_id IS NOT NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS cursor_session_id text,
  ADD COLUMN IF NOT EXISTS cursor_session_url text;

COMMENT ON COLUMN public.tasks.cursor_session_id IS 'Latest Cursor Cloud Agent bc-… for this task.';
COMMENT ON COLUMN public.tasks.cursor_session_url IS 'https://cursor.com/agents/bc-… for the active Cursor session on this task.';

ALTER TABLE public.cursor_dispatches DROP CONSTRAINT IF EXISTS cursor_dispatches_tool_check;
ALTER TABLE public.cursor_dispatches ADD CONSTRAINT cursor_dispatches_tool_check
  CHECK (tool IN (
    'request_dev_task',
    'ask_cursor',
    'reply_to_cursor_session',
    'generate_creative',
    'dispatch-cursor-tasks'
  ));

ALTER TABLE public.cursor_task_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cursor_task_sessions_tenant_read ON public.cursor_task_sessions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );
