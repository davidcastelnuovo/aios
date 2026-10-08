-- Add task_overdue to automation_trigger enum
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'task_overdue';

-- Add column to track when overdue notification was sent (prevents duplicate notifications)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;