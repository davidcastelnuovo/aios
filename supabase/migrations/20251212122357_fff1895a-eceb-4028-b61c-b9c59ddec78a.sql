-- Add lead_id column to tasks table
ALTER TABLE public.tasks
ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_tasks_lead_id ON public.tasks(lead_id);

-- Update RLS policies to include lead access
-- Users can view tasks for leads they have access to
CREATE POLICY "Users can view tasks for their leads"
ON public.tasks
FOR SELECT
USING (
  lead_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = tasks.lead_id
      AND (
        l.tenant_id = get_user_tenant_id(auth.uid())
        OR is_super_admin(auth.uid())
      )
    )
  )
);