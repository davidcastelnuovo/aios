-- Step 1: Create helper function to check if user has permission for an integration
CREATE OR REPLACE FUNCTION public.user_has_integration_access(p_integration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.integration_user_permissions 
    WHERE integration_id = p_integration_id 
    AND user_id = auth.uid()
  );
$$;

-- Step 2: Create helper function to check if user owns an integration
CREATE OR REPLACE FUNCTION public.user_owns_integration(p_integration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_integrations 
    WHERE id = p_integration_id 
    AND user_id = auth.uid()
  );
$$;

-- Step 3: Drop all problematic SELECT policies on tenant_integrations
DROP POLICY IF EXISTS "Users can view integrations they have permission to use" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Users can view their own integrations" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Users can view tenant integrations" ON public.tenant_integrations;

-- Step 4: Create ONE unified SELECT policy on tenant_integrations
CREATE POLICY "Users can view accessible integrations"
ON public.tenant_integrations
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.user_is_tenant_member(tenant_id)
  OR public.user_has_integration_access(id)
);

-- Step 5: Drop problematic policies on integration_user_permissions
DROP POLICY IF EXISTS "Users can view their own granted permissions" ON public.integration_user_permissions;
DROP POLICY IF EXISTS "Integration owners can manage permissions" ON public.integration_user_permissions;

-- Step 6: Create safe policies on integration_user_permissions using SECURITY DEFINER functions
CREATE POLICY "Users can view permissions granted to them"
ON public.integration_user_permissions
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Integration owners can manage permissions"
ON public.integration_user_permissions
FOR ALL
USING (
  public.is_super_admin(auth.uid())
  OR public.user_owns_integration(integration_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.user_owns_integration(integration_id)
);