-- Add due_time column to tasks table for time-based scheduling
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time TIME DEFAULT NULL;