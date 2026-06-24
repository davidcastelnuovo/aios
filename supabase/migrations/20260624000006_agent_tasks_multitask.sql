-- Multitask hardening for agent_tasks (Carmen's background task queue).
-- Grounded in multi-agent best practices (Anthropic orchestrator-worker,
-- Temporal/WorkOS durable-queue + idempotency, MAST failure taxonomy):
--   idempotency_key — dedupe at-least-once retries to the same task
--   batch_id        — group subtasks spawned together (delegate_parallel) so
--                     results can be aggregated / waited on as a set
-- Both nullable & additive — existing tasks and code paths are unaffected.

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS batch_id text;

-- Dedupe: a tenant can't have two live tasks with the same idempotency key.
-- Partial unique index (only when a key is set) so normal keyless tasks are
-- unaffected. Scoped to tenant_id to stay within tenant isolation.
CREATE UNIQUE INDEX IF NOT EXISTS agent_tasks_idempotency_uniq
  ON public.agent_tasks (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Fast lookup of a batch's members for aggregation.
CREATE INDEX IF NOT EXISTS agent_tasks_batch_idx
  ON public.agent_tasks (batch_id)
  WHERE batch_id IS NOT NULL;

COMMENT ON COLUMN public.agent_tasks.idempotency_key IS 'Optional dedupe key; a live task with the same (tenant_id, key) is reused instead of duplicated.';
COMMENT ON COLUMN public.agent_tasks.batch_id IS 'Groups subtasks spawned together by delegate_parallel for set-wise aggregation.';
