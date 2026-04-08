
-- Create communication_logs table
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'normal',
  interaction_type text DEFAULT 'other',
  note text,
  updated_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Users in the same tenant can read/write
CREATE POLICY "Tenant users can view communication_logs"
  ON public.communication_logs FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can insert communication_logs"
  ON public.communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- Service role (edge functions) can also insert
CREATE POLICY "Service role can manage communication_logs"
  ON public.communication_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_communication_logs_client_tenant 
  ON public.communication_logs(client_id, tenant_id, created_at DESC);
