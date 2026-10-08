-- Create integration_user_permissions table
CREATE TABLE IF NOT EXISTS public.integration_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(integration_id, user_id)
);

-- Enable RLS
ALTER TABLE public.integration_user_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Integration owners can manage permissions for their integrations
CREATE POLICY "Integration owners can manage permissions"
ON public.integration_user_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_integrations ti
    WHERE ti.id = integration_user_permissions.integration_id
    AND (ti.user_id = auth.uid() OR ti.tenant_id = get_user_tenant_id(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_integrations ti
    WHERE ti.id = integration_user_permissions.integration_id
    AND (ti.user_id = auth.uid() OR ti.tenant_id = get_user_tenant_id(auth.uid()))
  )
);

-- Policy: Users can view permissions for integrations they have access to
CREATE POLICY "Users can view their permissions"
ON public.integration_user_permissions
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tenant_integrations ti
    WHERE ti.id = integration_user_permissions.integration_id
    AND ti.user_id = auth.uid()
  )
);

-- Policy: Super admins can manage all permissions
CREATE POLICY "Super admins can manage all permissions"
ON public.integration_user_permissions
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create function to check if user has permission to use an integration
CREATE OR REPLACE FUNCTION public.user_has_integration_permission(
  p_user_id UUID,
  p_integration_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_integration RECORD;
BEGIN
  -- Get integration details
  SELECT * INTO v_integration
  FROM tenant_integrations
  WHERE id = p_integration_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Super admin always has access
  IF is_super_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Owner of the integration always has access
  IF v_integration.user_id = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- For tenant-level integrations (ManyChat), owners have access
  IF v_integration.user_id IS NULL AND has_role(p_user_id, 'owner'::app_role) THEN
    RETURN TRUE;
  END IF;
  
  -- Check explicit permission
  RETURN EXISTS (
    SELECT 1
    FROM integration_user_permissions
    WHERE integration_id = p_integration_id
    AND user_id = p_user_id
  );
END;
$$;

-- Create index for performance
CREATE INDEX idx_integration_user_permissions_integration_id ON public.integration_user_permissions(integration_id);
CREATE INDEX idx_integration_user_permissions_user_id ON public.integration_user_permissions(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_integration_user_permissions_updated_at
BEFORE UPDATE ON public.integration_user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();