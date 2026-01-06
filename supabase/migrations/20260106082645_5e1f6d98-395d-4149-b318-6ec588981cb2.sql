-- Add google_calendar_event_id column to tasks table for bidirectional sync
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_google_calendar_event_id ON public.tasks(google_calendar_event_id);