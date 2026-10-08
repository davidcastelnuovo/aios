-- Add sort_order column to tasks table for reordering within a day
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;