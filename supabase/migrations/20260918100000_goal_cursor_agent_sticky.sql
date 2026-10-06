-- Per-goal sticky Cursor agent — one bc-… session per autonomous goal (not per dev_task).

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS cursor_agent_id text,
  ADD COLUMN IF NOT EXISTS cursor_session_url text;

COMMENT ON COLUMN public.goals.cursor_agent_id IS
  'Sticky Cursor Cloud Agent (bc-…) for this goal. All technical work on the goal follows up here.';
COMMENT ON COLUMN public.goals.cursor_session_url IS
  'https://cursor.com/agents/bc-… for the goal sticky session.';

CREATE INDEX IF NOT EXISTS idx_goals_cursor_agent
  ON public.goals (cursor_agent_id)
  WHERE cursor_agent_id IS NOT NULL;
