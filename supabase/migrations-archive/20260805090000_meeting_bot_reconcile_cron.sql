-- Retry meeting bot sessions that never finished ingesting.
--
-- Recall's `bot.done` fires when the bot leaves the call, but the transcript
-- artifact is frequently still processing at that point, and copying a long
-- meeting's video can outlive the webhook invocation. Either way the session is
-- left in `processing` with no transcript. This job re-checks such sessions
-- against Recall every minute and finishes them.

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'meeting-bot-reconcile-every-minute';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'meeting-bot-reconcile-every-minute',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/meeting-bot-reconcile',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'task_worker_anon_key'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    $cron$
  );
END;
$$;
