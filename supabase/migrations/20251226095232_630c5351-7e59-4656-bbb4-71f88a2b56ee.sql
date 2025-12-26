-- Add new columns to leads table for meeting tracking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS meeting_set_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS meeting_date DATE,
ADD COLUMN IF NOT EXISTS meeting_time TEXT,
ADD COLUMN IF NOT EXISTS meeting_location TEXT,
ADD COLUMN IF NOT EXISTS meeting_reminder_day_after_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS meeting_reminder_same_day_sent_at TIMESTAMP WITH TIME ZONE;

-- Add new trigger types to automation_trigger enum
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'meeting_day_after';
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'meeting_same_day';

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_leads_meeting_date ON public.leads(meeting_date) WHERE meeting_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_meeting_set_date ON public.leads(meeting_set_date) WHERE meeting_set_date IS NOT NULL;