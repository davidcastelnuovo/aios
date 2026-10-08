-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view task updates for their tasks" ON public.task_updates;
DROP POLICY IF EXISTS "Users can create task updates for their tasks" ON public.task_updates;
DROP POLICY IF EXISTS "Users can update their own task updates" ON public.task_updates;
DROP POLICY IF EXISTS "Users can delete their own task updates" ON public.task_updates;
DROP POLICY IF EXISTS "Users can view task updates" ON public.task_updates;
DROP POLICY IF EXISTS "Users can create task updates" ON public.task_updates;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_task_updates_task_id;
DROP INDEX IF EXISTS idx_task_updates_created_at;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_task_updates_updated_at ON public.task_updates;

-- Drop table if exists
DROP TABLE IF EXISTS public.task_updates;

-- Create task_updates table for threading updates under tasks
CREATE TABLE public.task_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;

-- Allow users to view updates for tasks they have access to
CREATE POLICY "Users can view task updates"
ON public.task_updates
FOR SELECT
USING (
  task_id IN (
    SELECT t.id FROM public.tasks t
    WHERE (
      t.agency_id = ANY (get_user_agency_ids(auth.uid()))
      OR has_role(auth.uid(), 'owner'::app_role)
      OR t.agency_id = ANY (get_user_sales_person_agency_ids(auth.uid()))
      OR user_manages_agency(auth.uid(), t.agency_id)
    )
  )
);

-- Allow users to create updates for tasks they have access to
CREATE POLICY "Users can create task updates"
ON public.task_updates
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND task_id IN (
    SELECT t.id FROM public.tasks t
    WHERE (
      t.agency_id = ANY (get_user_agency_ids(auth.uid()))
      OR has_role(auth.uid(), 'owner'::app_role)
      OR t.agency_id = ANY (get_user_sales_person_agency_ids(auth.uid()))
      OR user_manages_agency(auth.uid(), t.agency_id)
    )
  )
);

-- Allow users to update their own updates
CREATE POLICY "Users can update own task updates"
ON public.task_updates
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own updates
CREATE POLICY "Users can delete own task updates"
ON public.task_updates
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for better performance
CREATE INDEX idx_task_updates_task_id ON public.task_updates(task_id);
CREATE INDEX idx_task_updates_created_at ON public.task_updates(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_task_updates_updated_at
BEFORE UPDATE ON public.task_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();