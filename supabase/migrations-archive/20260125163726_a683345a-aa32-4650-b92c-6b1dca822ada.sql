-- Add dashboard_type column to distinguish between client and agency dashboards
ALTER TABLE public.crm_dashboards 
ADD COLUMN IF NOT EXISTS dashboard_type TEXT DEFAULT 'client';

-- Add check constraint
ALTER TABLE public.crm_dashboards 
ADD CONSTRAINT crm_dashboards_type_check 
CHECK (dashboard_type IN ('client', 'agency'));