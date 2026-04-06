-- Upgrade agent_tasks table with scheduling, skills, and parallel execution support
ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS cron_expression text,
  ADD COLUMN IF NOT EXISTS task_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS task_mode text,
  ADD COLUMN IF NOT EXISTS parallel_execution boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parallel_subtasks jsonb,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_run timestamptz,
  ADD COLUMN IF NOT EXISTS next_run timestamptz,
  ADD COLUMN IF NOT EXISTS run_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- schedule_type values: 'once' | 'scheduled' | 'recurring'
-- cron_expression: standard cron (e.g. '0 7 * * *' = every day at 07:00)

COMMENT ON COLUMN public.agent_tasks.schedule_type IS 'once | scheduled | recurring';
COMMENT ON COLUMN public.agent_tasks.cron_expression IS 'Standard cron expression for recurring tasks';
COMMENT ON COLUMN public.agent_tasks.task_skills IS 'Array of skill IDs to inject for this specific task';
COMMENT ON COLUMN public.agent_tasks.task_mode IS 'Agent mode to activate for this task';
COMMENT ON COLUMN public.agent_tasks.parallel_execution IS 'Whether to split task into parallel sub-processes';
COMMENT ON COLUMN public.agent_tasks.parallel_subtasks IS 'JSON array of sub-task definitions for parallel execution';
COMMENT ON COLUMN public.agent_tasks.enabled IS 'Whether recurring task is active';
COMMENT ON COLUMN public.agent_tasks.last_run IS 'Timestamp of last execution';
COMMENT ON COLUMN public.agent_tasks.next_run IS 'Timestamp of next scheduled execution';
COMMENT ON COLUMN public.agent_tasks.run_count IS 'Total number of executions';
COMMENT ON COLUMN public.agent_tasks.scheduled_at IS 'One-time scheduled execution time';
