-- Production: dedupe Carmen task_assigned WhatsApp (Felix → Leon double message).
-- Mirrors supabase/migrations/20260922160000_fix_duplicate_task_reminder_notifications.sql
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.task_notification_deliveries (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  recipient_key text NOT NULL DEFAULT '',
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, notification_type, recipient_key)
);

CREATE INDEX IF NOT EXISTS idx_task_notification_deliveries_delivered_at
  ON public.task_notification_deliveries (delivered_at DESC);

ALTER TABLE public.task_notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
DROP FUNCTION IF EXISTS public.notify_task_assigned();

CREATE OR REPLACE FUNCTION public.notify_task_notification_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.campaigner_id IS DISTINCT FROM NEW.campaigner_id
       OR OLD.sales_person_id IS DISTINCT FROM NEW.sales_person_id THEN
      NEW.assignment_notification_sent_at := NULL;
      IF NEW.status <> 'done' THEN
        NEW.high_priority_reminder_sent_at := NULL;
        NEW.high_priority_creator_notified_at := NULL;
      END IF;
    END IF;

    IF OLD.due_date IS DISTINCT FROM NEW.due_date AND NEW.status <> 'done' THEN
      IF NEW.due_date IS NOT NULL
         AND (OLD.due_date IS NULL OR NEW.due_date > OLD.due_date) THEN
        NEW.overdue_notified_at := NULL;
        NEW.overdue_creator_notified_at := NULL;
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
     OR OLD.sales_person_id IS DISTINCT FROM NEW.sales_person_id
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
BEFORE INSERT OR UPDATE OF campaigner_id, sales_person_id, status, priority, due_date, due_time, self_reminder_at
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_notification_worker();
