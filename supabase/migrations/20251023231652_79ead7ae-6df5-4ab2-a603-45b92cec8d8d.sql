-- Add new columns for CSV import
-- Keep 'status' as pipeline stage (lead_status type)
-- Add 'general_status' for general status text

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS general_status text,
ADD COLUMN IF NOT EXISTS monthly_budget numeric,
ADD COLUMN IF NOT EXISTS three_month_budget numeric,
ADD COLUMN IF NOT EXISTS proposal_date date,
ADD COLUMN IF NOT EXISTS closing_date date;