-- Mirror: supabase/migrations/20260830120000_cursor_human_task_queue.sql

ALTER TABLE public.cursor_dispatches
  ADD COLUMN IF NOT EXISTS human_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cursor_dispatches_human_task
  ON public.cursor_dispatches(human_task_id)
  WHERE human_task_id IS NOT NULL;
