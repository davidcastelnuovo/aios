-- Parallel sub-projects: one sticky Cursor agent per plan step (department/track).

ALTER TABLE public.goal_plan_steps
  ADD COLUMN IF NOT EXISTS sub_project_key text,
  ADD COLUMN IF NOT EXISTS sub_project_label text,
  ADD COLUMN IF NOT EXISTS parallel_track boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cursor_agent_id text,
  ADD COLUMN IF NOT EXISTS cursor_session_url text;

COMMENT ON COLUMN public.goal_plan_steps.parallel_track IS
  'When true, this cursor step runs in parallel with other parallel_track steps on the same goal.';
COMMENT ON COLUMN public.goal_plan_steps.sub_project_key IS
  'Stable id for a sub-project track (e.g. creative, copy, seo) — owns its own Cursor agent.';
COMMENT ON COLUMN public.goal_plan_steps.cursor_agent_id IS
  'Sticky Cursor agent (bc-…) dedicated to this sub-project track.';

CREATE INDEX IF NOT EXISTS idx_goal_plan_steps_parallel
  ON public.goal_plan_steps (goal_id, parallel_track, status)
  WHERE parallel_track = true;
