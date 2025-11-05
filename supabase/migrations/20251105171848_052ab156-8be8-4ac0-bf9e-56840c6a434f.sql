-- Create function to get effective tenant ID (supports super admin switching)
-- This function first checks if there's a session variable for selected tenant (for super admins)
-- Otherwise returns the user's default tenant
CREATE OR REPLACE FUNCTION public.get_effective_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For now, just return user's tenant
  -- In the future, we can add session variable support for super admin switching
  RETURN (
    SELECT tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

COMMENT ON FUNCTION public.get_effective_tenant_id() IS 
'Returns the effective tenant ID for the current user. Used by RLS policies to ensure tenant isolation.';