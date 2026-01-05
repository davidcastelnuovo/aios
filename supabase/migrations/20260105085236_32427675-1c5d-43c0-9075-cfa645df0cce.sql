-- Create task_collaborators table for shared tasks
CREATE TABLE public.task_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  campaigner_id UUID NOT NULL REFERENCES public.campaigners(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by UUID REFERENCES auth.users(id),
  UNIQUE(task_id, campaigner_id)
);

-- Enable RLS
ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view collaborators in their tenant"
ON public.task_collaborators
FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can add collaborators in their tenant"
ON public.task_collaborators
FOR INSERT
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can remove collaborators in their tenant"
ON public.task_collaborators
FOR DELETE
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_collaborators;

-- Add index for performance
CREATE INDEX idx_task_collaborators_task_id ON public.task_collaborators(task_id);
CREATE INDEX idx_task_collaborators_campaigner_id ON public.task_collaborators(campaigner_id);
CREATE INDEX idx_task_collaborators_tenant_id ON public.task_collaborators(tenant_id);