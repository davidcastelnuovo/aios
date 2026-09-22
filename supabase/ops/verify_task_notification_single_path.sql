-- Ops: confirm only the task-notification-worker path is wired on tasks.
-- Run on Production after applying 20260922160000_fix_duplicate_task_reminder_notifications.sql.
-- Expected: legacy_trigger_count = 0, worker_trigger_count >= 1

SELECT
  count(*) FILTER (
    WHERE tgname = 'trg_notify_task_assigned'
  ) AS legacy_trigger_count,
  count(*) FILTER (
    WHERE tgname = 'trg_notify_task_notification_worker'
  ) AS worker_trigger_count
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'tasks'
  AND NOT t.tgisinternal;

SELECT EXISTS (
  SELECT 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_task_assigned'
) AS legacy_function_still_exists;

SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'task_notification_deliveries'
) AS dedupe_table_exists;
