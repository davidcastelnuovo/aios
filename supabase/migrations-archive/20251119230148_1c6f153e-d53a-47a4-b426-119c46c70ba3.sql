-- Update the user_has_integration_permission function to allow all tenant members
-- to access integrations without a specific owner (user_id IS NULL)
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
  
  -- For tenant-level integrations (user_id IS NULL), all tenant members have access
  IF v_integration.user_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM tenant_users
      WHERE tenant_id = v_integration.tenant_id
      AND user_id = p_user_id
    );
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