-- Create task_updates table for threading updates under tasks
CREATE TABLE IF NOT EXISTS public.task_updates (
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
CREATE POLICY "Users can view task updates for their tasks"
ON public.task_updates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_updates.task_id
    AND tasks.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Allow users to create updates for tasks they have access to
CREATE POLICY "Users can create task updates for their tasks"
ON public.task_updates
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_updates.task_id
    AND tasks.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Allow users to update their own updates
CREATE POLICY "Users can update their own task updates"
ON public.task_updates
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own updates
CREATE POLICY "Users can delete their own task updates"
ON public.task_updates
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for better performance
CREATE INDEX idx_task_updates_task_id ON public.task_updates(task_id);
CREATE INDEX idx_task_updates_created_at ON public.task_updates(created_at DESC);