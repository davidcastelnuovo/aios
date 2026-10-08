
CREATE TABLE public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 5,
  result jsonb,
  created_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent tasks in their tenant"
  ON public.agent_tasks FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can insert agent tasks in their tenant"
  ON public.agent_tasks FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can update agent tasks in their tenant"
  ON public.agent_tasks FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can delete agent tasks in their tenant"
  ON public.agent_tasks FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role full access on agent_tasks"
  ON public.agent_tasks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks;

CREATE TRIGGER update_agent_tasks_updated_at
  BEFORE UPDATE ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
