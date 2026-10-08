
-- Change response_status from ENUM to TEXT to support dynamic custom statuses
-- This allows the lead_statuses table to define any custom status keys

-- Step 1: Add a temporary text column
ALTER TABLE public.leads ADD COLUMN response_status_new TEXT;

-- Step 2: Copy existing data (cast enum to text)
UPDATE public.leads SET response_status_new = response_status::TEXT WHERE response_status IS NOT NULL;

-- Step 3: Drop the old enum column
ALTER TABLE public.leads DROP COLUMN response_status;

-- Step 4: Rename the new column
ALTER TABLE public.leads RENAME COLUMN response_status_new TO response_status;

-- Step 5: Add a comment for documentation
COMMENT ON COLUMN public.leads.response_status IS 'Dynamic response status - references status_key from lead_statuses table';
