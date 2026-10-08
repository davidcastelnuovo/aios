-- Separate deadline (תאריך יעד) from execution schedule (due_date + due_time).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS target_date date;

COMMENT ON COLUMN public.tasks.target_date IS
  'Deadline by which the task should be completed (תאריך יעד). due_date/due_time schedule execution on the calendar.';

CREATE INDEX IF NOT EXISTS idx_tasks_target_date ON public.tasks (target_date);
