-- Add duration_minutes column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;