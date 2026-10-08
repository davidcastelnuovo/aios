-- Step 1: Create SECURITY DEFINER function to check tenant membership
CREATE OR REPLACE FUNCTION public.user_is_tenant_member(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users 
    WHERE user_id = auth.uid() 
    AND tenant_id = check_tenant_id
  );
$$;

-- Step 2: Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view tenant integrations" ON public.tenant_integrations;

-- Step 3: Create new policy using the SECURITY DEFINER function
CREATE POLICY "Users can view tenant integrations"
ON public.tenant_integrations
FOR SELECT
USING (
  public.user_is_tenant_member(tenant_id)
);