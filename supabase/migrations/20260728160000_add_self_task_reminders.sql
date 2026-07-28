-- Self-assigned tasks are silent by default. A user can explicitly opt in to
-- one Carmen reminder at a chosen time.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS self_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS self_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_pending_self_reminders
  ON public.tasks (self_reminder_at)
  WHERE self_reminder_at IS NOT NULL
    AND self_reminder_sent_at IS NULL
    AND status <> 'done';

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
