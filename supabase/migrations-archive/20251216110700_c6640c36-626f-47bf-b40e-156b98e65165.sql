-- Allow tasks to be assigned to a sales person without requiring a campaigner
ALTER TABLE public.tasks
  ALTER COLUMN campaigner_id DROP NOT NULL;