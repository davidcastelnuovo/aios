
-- Goals table (hierarchical goal system)
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  owner_type TEXT NOT NULL DEFAULT 'campaigner' CHECK (owner_type IN ('agent', 'campaigner')),
  owner_id TEXT,
  progress_percent NUMERIC(5,2) DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Heartbeat logs table
CREATE TABLE public.heartbeat_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tasks_reviewed INTEGER DEFAULT 0,
  actions_taken JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add goal_id and assigned_agent to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_agent TEXT;

-- Add update_type to task_updates
ALTER TABLE public.task_updates ADD COLUMN IF NOT EXISTS update_type TEXT NOT NULL DEFAULT 'comment';

-- Enable RLS on new tables
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heartbeat_logs ENABLE ROW LEVEL SECURITY;

-- RLS for goals
CREATE POLICY "Users can view goals in their tenant" ON public.goals
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert goals in their tenant" ON public.goals
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update goals in their tenant" ON public.goals
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can delete goals in their tenant" ON public.goals
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- RLS for heartbeat_logs
CREATE POLICY "Users can view heartbeat logs in their tenant" ON public.heartbeat_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Service can insert heartbeat logs" ON public.heartbeat_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- Auto-update updated_at on goals
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
