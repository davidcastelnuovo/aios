-- Review follow-ups for reliable WhatsApp → automation dispatch (AIO-204).
--
-- 1. processed_webhook_messages.completed_at: green-api-webhook marks its
--    message claim done once the message is stored. An unfinished claim older
--    than the lease (5 min) belongs to an invocation that died mid-way, so
--    Green API's retry may take it over instead of being dropped as a duplicate.
--    Existing rows (Manus claims, Carmen group fingerprints) keep NULL; only
--    green-api-webhook reads this column.
-- 2. Index for trigger-automation's per-group run budget (loop bound), which
--    counts recent runs by tenant, trigger and entity.

ALTER TABLE public.processed_webhook_messages
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS automation_executions_run_budget_idx
  ON public.automation_executions (tenant_id, trigger_type, entity_id, started_at DESC);
