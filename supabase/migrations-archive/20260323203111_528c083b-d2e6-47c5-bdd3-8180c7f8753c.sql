
-- Create manus_tasks table
CREATE TABLE public.manus_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  title TEXT,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  task_url TEXT,
  share_url TEXT,
  output JSONB,
  credit_usage INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant queries
CREATE INDEX idx_manus_tasks_tenant_id ON public.manus_tasks(tenant_id);
CREATE INDEX idx_manus_tasks_task_id ON public.manus_tasks(task_id);

-- Enable RLS
ALTER TABLE public.manus_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view manus tasks in their tenant"
  ON public.manus_tasks FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id());

CREATE POLICY "Users can insert manus tasks in their tenant"
  ON public.manus_tasks FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id());

CREATE POLICY "Users can update manus tasks in their tenant"
  ON public.manus_tasks FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id());

CREATE POLICY "Users can delete manus tasks in their tenant"
  ON public.manus_tasks FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id());

-- Super admin access
CREATE POLICY "Super admins can manage all manus tasks"
  ON public.manus_tasks FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_manus_tasks_updated_at
  BEFORE UPDATE ON public.manus_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
