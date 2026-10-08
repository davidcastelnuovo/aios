CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'frontend' | 'function' | 'automation'
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB DEFAULT '{}',
  url TEXT,
  user_id UUID,
  resolved BOOLEAN DEFAULT false,
  sent_to_agent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all error logs"
ON public.error_logs FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can insert error logs for their tenant"
ON public.error_logs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX idx_error_logs_tenant ON public.error_logs(tenant_id, created_at DESC);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved, sent_to_agent);
