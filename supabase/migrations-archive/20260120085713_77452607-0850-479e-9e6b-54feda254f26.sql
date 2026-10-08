-- Add follow_up_date column to leads table
ALTER TABLE public.leads 
ADD COLUMN follow_up_date DATE;

-- Create index for efficient filtering by follow-up date
CREATE INDEX idx_leads_follow_up_date ON public.leads(follow_up_date);

-- Add comment for documentation
COMMENT ON COLUMN public.leads.follow_up_date IS 'Date to follow up with this lead';