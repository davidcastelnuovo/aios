-- Reliable WhatsApp → automation dispatch.
--
-- The processed_webhook_messages unique key that green-api-webhook's new
-- idMessage claim relies on is added by 20261021090000.
--
-- 1. automation_executions rows were inserted as 'running' and never closed,
--    which turned trigger-automation's 30s cooldown into "drop every group
--    message within 30s of the previous one". The function now closes each row;
--    mark the historical rows as abandoned.
-- 2. Daily retention for both tables (SQL-only pg_cron jobs, no HTTP).
--
-- No message is replayed: this only changes bookkeeping rows.

-- 1. automation_executions: close stale rows -----------------------------------
UPDATE public.automation_executions
SET status = 'abandoned',
    finished_at = started_at
WHERE status = 'running'
  AND started_at < now() - interval '10 minutes';

-- 2. Retention ----------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'cleanup-processed-webhook-messages',
      'cleanup-automation-executions'
    );

    PERFORM cron.schedule(
      'cleanup-processed-webhook-messages',
      '17 3 * * *',
      $job$DELETE FROM public.processed_webhook_messages
           WHERE processed_at < now() - interval '14 days'$job$
    );

    PERFORM cron.schedule(
      'cleanup-automation-executions',
      '27 3 * * *',
      $job$DELETE FROM public.automation_executions
           WHERE started_at < now() - interval '30 days'$job$
    );
  END IF;
END
$$;
