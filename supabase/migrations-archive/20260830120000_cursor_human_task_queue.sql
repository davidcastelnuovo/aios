-- Link Carmen human tasks (public.tasks) ↔ Cursor dispatches for auto-queue.

ALTER TABLE public.cursor_dispatches
  ADD COLUMN IF NOT EXISTS human_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cursor_dispatches_human_task
  ON public.cursor_dispatches(human_task_id)
  WHERE human_task_id IS NOT NULL;

COMMENT ON COLUMN public.cursor_dispatches.human_task_id IS
  'When set, this dispatch was spawned from public.tasks assigned to Cursor. Used by dispatch-cursor-tasks queue.';
