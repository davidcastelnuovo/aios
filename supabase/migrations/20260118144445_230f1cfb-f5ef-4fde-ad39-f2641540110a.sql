-- Step 1: Convert leads.status from enum to TEXT for dynamic pipeline stages

-- Add temporary TEXT column
ALTER TABLE public.leads ADD COLUMN status_new TEXT;

-- Copy existing status values to the new column
UPDATE public.leads SET status_new = status::text;

-- Drop the old enum column
ALTER TABLE public.leads DROP COLUMN status;

-- Rename the new column to status
ALTER TABLE public.leads RENAME COLUMN status_new TO status;

-- Set default value and NOT NULL constraint
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE public.leads ALTER COLUMN status SET NOT NULL;

-- Create index for better query performance on status
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);