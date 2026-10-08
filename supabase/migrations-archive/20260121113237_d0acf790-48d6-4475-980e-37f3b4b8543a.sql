-- Create table for sharing integrations between tenants
CREATE TABLE IF NOT EXISTS public.integration_tenant_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  accessing_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(integration_id, accessing_tenant_id)
);

-- Enable RLS
ALTER TABLE public.integration_tenant_access ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view integration access for their tenant"
ON public.integration_tenant_access FOR SELECT
USING (
  accessing_tenant_id = get_user_tenant_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM tenant_integrations ti
    WHERE ti.id = integration_id
    AND ti.tenant_id = get_user_tenant_id(auth.uid())
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Owners can manage integration sharing"
ON public.integration_tenant_access FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tenant_integrations ti
    WHERE ti.id = integration_id
    AND ti.tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
  OR is_super_admin(auth.uid())
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_integration_tenant_access_integration 
ON public.integration_tenant_access(integration_id);

CREATE INDEX IF NOT EXISTS idx_integration_tenant_access_tenant 
ON public.integration_tenant_access(accessing_tenant_id);

-- Deactivate the NEWER integration (marlog-leads) instead of the older one
UPDATE public.tenant_integrations 
SET is_active = false 
WHERE id = '7dc98e01-53ca-4e48-82ea-c17dbb0b1dd1';