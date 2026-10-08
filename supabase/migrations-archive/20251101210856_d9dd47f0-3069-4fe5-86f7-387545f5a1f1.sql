-- Add campaign_name column to leads table
ALTER TABLE public.leads 
ADD COLUMN campaign_name TEXT;