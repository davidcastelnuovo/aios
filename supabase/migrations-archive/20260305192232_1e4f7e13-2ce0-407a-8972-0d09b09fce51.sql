
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  engine TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  personality TEXT,
  soul TEXT,
  talent TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agents in their tenant"
ON public.ai_agents FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert agents in their tenant"
ON public.ai_agents FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update agents in their tenant"
ON public.ai_agents FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete agents in their tenant"
ON public.ai_agents FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));
