-- Create tenant_integrations table for storing integration settings
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  integration_type TEXT NOT NULL DEFAULT 'sumit',
  api_key TEXT,
  company_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, integration_type)
);

-- Enable RLS
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Owners can manage their tenant integrations
CREATE POLICY "Owners can manage tenant integrations"
ON public.tenant_integrations
FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Super admins can manage all integrations
CREATE POLICY "Super admins can manage all integrations"
ON public.tenant_integrations
FOR ALL
USING (is_super_admin(auth.uid()));

-- Users with accounting permission can view integrations
CREATE POLICY "Users with accounting permission can view"
ON public.tenant_integrations
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
      AND module = 'accounting'
      AND can_access = true
    )
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_tenant_integrations_updated_at
BEFORE UPDATE ON public.tenant_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();