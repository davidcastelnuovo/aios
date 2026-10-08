
-- Heartbeat settings per tenant
CREATE TABLE public.tenant_heartbeat_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  interval_hours INTEGER NOT NULL DEFAULT 8,
  active_hours_start INTEGER NOT NULL DEFAULT 7,
  active_hours_end INTEGER NOT NULL DEFAULT 22,
  allowed_actions JSONB NOT NULL DEFAULT '["reminders","status_update","daily_summary"]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.tenant_heartbeat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant heartbeat settings"
ON public.tenant_heartbeat_settings FOR SELECT
TO authenticated
USING (tenant_id = public.get_effective_tenant_id());

CREATE POLICY "Users can insert their tenant heartbeat settings"
ON public.tenant_heartbeat_settings FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_effective_tenant_id());

CREATE POLICY "Users can update their tenant heartbeat settings"
ON public.tenant_heartbeat_settings FOR UPDATE
TO authenticated
USING (tenant_id = public.get_effective_tenant_id())
WITH CHECK (tenant_id = public.get_effective_tenant_id());
