-- Add created_by column to tasks table to track who created the task
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Set default value for new tasks
ALTER TABLE public.tasks 
ALTER COLUMN created_by SET DEFAULT auth.uid();