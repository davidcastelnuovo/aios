-- Add proposal_sent_date column to leads table
ALTER TABLE public.leads 
ADD COLUMN proposal_sent_date date;