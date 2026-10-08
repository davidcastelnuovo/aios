-- Add column to store the connected Google account email
ALTER TABLE public.calendar_tokens 
ADD COLUMN IF NOT EXISTS google_email TEXT;