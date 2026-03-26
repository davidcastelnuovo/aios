
-- Call logs table
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  caller_user_id UUID NOT NULL,
  from_number TEXT,
  to_number TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy', 'cancelled')),
  recording_url TEXT,
  recording_duration INTEGER,
  provider_call_id TEXT,
  provider TEXT DEFAULT 'paycall',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Telephony settings per user per tenant
CREATE TABLE public.telephony_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  personal_phone TEXT,
  virtual_number TEXT,
  auto_record BOOLEAN DEFAULT true,
  provider TEXT DEFAULT 'paycall',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Indexes
CREATE INDEX idx_call_logs_tenant ON public.call_logs(tenant_id);
CREATE INDEX idx_call_logs_lead ON public.call_logs(lead_id);
CREATE INDEX idx_call_logs_client ON public.call_logs(client_id);
CREATE INDEX idx_call_logs_user ON public.call_logs(caller_user_id);
CREATE INDEX idx_telephony_settings_tenant ON public.telephony_settings(tenant_id);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telephony_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_logs
CREATE POLICY "Users can view call logs in their tenant"
  ON public.call_logs FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can insert call logs in their tenant"
  ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can update call logs in their tenant"
  ON public.call_logs FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- RLS policies for telephony_settings
CREATE POLICY "Users can view telephony settings in their tenant"
  ON public.telephony_settings FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can manage own telephony settings"
  ON public.telephony_settings FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can update own telephony settings"
  ON public.telephony_settings FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- Enable realtime for call_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;

-- Updated_at trigger
CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON public.call_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telephony_settings_updated_at
  BEFORE UPDATE ON public.telephony_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
