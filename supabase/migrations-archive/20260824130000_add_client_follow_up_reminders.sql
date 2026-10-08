-- Client follow-up reminders: Carmen alerts campaigners and managers when a client
-- needs to be spoken with (follow_up_date). Mirrors task-notification-worker cadence.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS follow_up_campaigner_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_manager_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clients_follow_up_date
  ON public.clients (follow_up_date)
  WHERE follow_up_date IS NOT NULL;

COMMENT ON COLUMN public.clients.follow_up_date IS 'Date by which the assigned team should speak with this client';
COMMENT ON COLUMN public.clients.follow_up_campaigner_notified_at IS 'When Carmen last notified assigned campaigners for this follow_up_date';
COMMENT ON COLUMN public.clients.follow_up_manager_notified_at IS 'When Carmen last notified managers/owners for this follow_up_date';

-- Prevent a reminder flood for rows that already have a follow-up date on rollout.
UPDATE public.clients
SET
  follow_up_campaigner_notified_at = COALESCE(follow_up_campaigner_notified_at, now()),
  follow_up_manager_notified_at = COALESCE(follow_up_manager_notified_at, now())
WHERE follow_up_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_client_follow_up_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.follow_up_date IS DISTINCT FROM NEW.follow_up_date THEN
      NEW.follow_up_campaigner_notified_at := NULL;
      NEW.follow_up_manager_notified_at := NULL;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.follow_up_date IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/client-follow-up-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'task_worker_anon_key'
        )
      ),
      body := jsonb_build_object('client_id', NEW.id),
      timeout_milliseconds := 5000
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.follow_up_date IS DISTINCT FROM NEW.follow_up_date THEN
    PERFORM net.http_post(
      url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/client-follow-up-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'task_worker_anon_key'
        )
      ),
      body := jsonb_build_object('client_id', NEW.id),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_client_follow_up_worker failed for client %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_client_follow_up_worker() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_client_follow_up_worker ON public.clients;
CREATE TRIGGER trg_notify_client_follow_up_worker
BEFORE INSERT OR UPDATE OF follow_up_date ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.notify_client_follow_up_worker();

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'client-follow-up-worker-every-minute';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'client-follow-up-worker-every-minute',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/client-follow-up-worker',
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
