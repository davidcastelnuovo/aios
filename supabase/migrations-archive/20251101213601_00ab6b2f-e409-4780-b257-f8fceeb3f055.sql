-- Add itai_meeting_date column to leads table
ALTER TABLE public.leads 
ADD COLUMN itai_meeting_date date;