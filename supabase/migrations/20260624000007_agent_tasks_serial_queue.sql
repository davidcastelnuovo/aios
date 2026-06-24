-- Q1: dual-lane serial queue for subagent batches.
-- Dangerous (mutating/side-effecting) subtasks run one-at-a-time in a serial
-- lane; safe (read-only) subtasks run in parallel. See docs/serial-queue-plan.md.
--   queue_position — order within the dangerous lane of a batch (0..N-1)
--   is_dangerous   — routing flag; default TRUE (conservative: serialize unless
--                    proven safe). Existing rows default to dangerous but have no
--                    batch_id, so the lane logic never touches them.
-- status='queued' (a dangerous subtask awaiting its turn) needs no constraint
-- change — agent_tasks.status is plain text with no CHECK.

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS queue_position integer,
  ADD COLUMN IF NOT EXISTS is_dangerous boolean NOT NULL DEFAULT true;

-- Fast lookup of the next queued dangerous task in a batch.
CREATE INDEX IF NOT EXISTS agent_tasks_danger_lane_idx
  ON public.agent_tasks (batch_id, queue_position)
  WHERE batch_id IS NOT NULL AND is_dangerous AND status = 'queued';

COMMENT ON COLUMN public.agent_tasks.queue_position IS 'Order within a batch dangerous (serial) lane; null for safe/parallel subtasks.';
COMMENT ON COLUMN public.agent_tasks.is_dangerous IS 'TRUE = mutating/side-effecting → serial lane; FALSE = read-only → parallel lane.';
