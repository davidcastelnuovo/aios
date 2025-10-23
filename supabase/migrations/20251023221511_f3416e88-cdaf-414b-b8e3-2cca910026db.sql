-- Make most fields in leads table nullable
ALTER TABLE public.leads
  ALTER COLUMN contact_name DROP NOT NULL,
  ALTER COLUMN sales_person_id DROP NOT NULL,
  ALTER COLUMN agency_id DROP NOT NULL;

-- Update default status to 'new' if not set
ALTER TABLE public.leads
  ALTER COLUMN status SET DEFAULT 'new';

-- Update default source to 'other' if not set
ALTER TABLE public.leads
  ALTER COLUMN source SET DEFAULT 'other';