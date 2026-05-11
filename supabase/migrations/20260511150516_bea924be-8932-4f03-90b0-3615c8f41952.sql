UPDATE public.agent_tasks
SET status='done',
    completed_at=now(),
    description = COALESCE(description, '') || E'\n\n[נסגר אוטומטית — ההתראה הוחלפה בלוגיקת סטטוס רשמית מפייסבוק]'
WHERE task_mode='anomaly_alert'
  AND status='open'
  AND title LIKE '🚨 חשבון פייסבוק עצר%';