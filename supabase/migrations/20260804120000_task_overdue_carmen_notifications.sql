-- Route overdue task follow-ups through the same Carmen notification worker
-- as assignment/reminder notifications, and reset the marker when due date moves.

CREATE OR REPLACE FUNCTION public.notify_task_notification_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.campaigner_id IS DISTINCT FROM NEW.campaigner_id THEN
      NEW.assignment_notification_sent_at := NULL;
    END IF;

    IF OLD.campaigner_id IS DISTINCT FROM NEW.campaigner_id
       OR OLD.priority IS DISTINCT FROM NEW.priority
       OR OLD.due_date IS DISTINCT FROM NEW.due_date
       OR OLD.due_time IS DISTINCT FROM NEW.due_time THEN
      IF NEW.status <> 'done' THEN
        NEW.high_priority_reminder_sent_at := NULL;
        NEW.high_priority_creator_notified_at := NULL;
      END IF;
    END IF;

    IF OLD.due_date IS DISTINCT FROM NEW.due_date AND NEW.status <> 'done' THEN
      NEW.overdue_notified_at := NULL;
    END IF;

    IF OLD.self_reminder_at IS DISTINCT FROM NEW.self_reminder_at THEN
      NEW.self_reminder_sent_at := NULL;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done' THEN
      NEW.completion_creator_notified_at := NULL;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM net.http_post(
      url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/task-notification-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'task_worker_anon_key'
        )
      ),
      body := jsonb_build_object('task_id', NEW.id),
      timeout_milliseconds := 5000
    );
  ELSIF OLD.campaigner_id IS DISTINCT FROM NEW.campaigner_id
     OR OLD.self_reminder_at IS DISTINCT FROM NEW.self_reminder_at
     OR OLD.due_date IS DISTINCT FROM NEW.due_date
     OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done') THEN
    PERFORM net.http_post(
      url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/task-notification-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'task_worker_anon_key'
        )
      ),
      body := jsonb_build_object('task_id', NEW.id),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_notification_worker failed for task %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_task_notification_worker() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_task_notification_worker ON public.tasks;
CREATE TRIGGER trg_notify_task_notification_worker
BEFORE INSERT OR UPDATE OF campaigner_id, status, priority, due_date, due_time, self_reminder_at ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_notification_worker();

CREATE INDEX IF NOT EXISTS idx_tasks_pending_overdue_notifications
  ON public.tasks (due_date)
  WHERE due_date IS NOT NULL
    AND overdue_notified_at IS NULL
    AND status <> 'done'
    AND campaigner_id IS NOT NULL;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'check-overdue-tasks-daily';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'check-overdue-tasks-daily',
    '30 5 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/check-overdue-tasks',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'task_worker_anon_key'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $cron$
  );
END;
$$;
