-- Tasks module correctness, applied together because both parts are required
-- for the agency filter and assignment alerts to behave on production data.
--
-- 1. Assignment notifications must also fire when a task is (re)assigned to a
--    sales person, not only to a campaigner.
-- 2. Tasks linked to a client must carry that client's agency. The board used
--    to stamp `tasks.agency_id` with the creator's first / default agency, so
--    filtering the header to one agency showed other agencies' clients and hid
--    tasks that did belong to the selected agency.
--
-- Both statements are idempotent: the trigger is replaced, and the backfill has
-- no rows left to touch once it has run.

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
    END IF;

    IF OLD.campaigner_id IS DISTINCT FROM NEW.campaigner_id
       OR OLD.sales_person_id IS DISTINCT FROM NEW.sales_person_id
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
      NEW.overdue_creator_notified_at := NULL;
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

-- Repoint tasks onto the agency of the client they belong to.
-- Tasks without a client keep their existing stamp.
UPDATE public.tasks AS t
SET agency_id = c.agency_id
FROM public.clients AS c
WHERE t.client_id = c.id
  AND c.agency_id IS NOT NULL
  AND t.agency_id IS DISTINCT FROM c.agency_id;
