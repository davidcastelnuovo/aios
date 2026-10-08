-- Copy studio (and other marketing departments) can create a work item before
-- it is assigned to a client. Assignment later pulls website/files into payload.
ALTER TABLE public.marketing_work_items
  ALTER COLUMN client_id DROP NOT NULL,
  ALTER COLUMN pipeline_id DROP NOT NULL;
