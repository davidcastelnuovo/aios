-- Step 1: Create SECURITY DEFINER function to get client IDs assigned to a campaigner
CREATE OR REPLACE FUNCTION public.get_user_client_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    ARRAY_AGG(ct.client_id),
    ARRAY[]::uuid[]
  )
  FROM public.profiles p
  JOIN public.client_team ct ON ct.campaigner_id = p.campaigner_id
  WHERE p.id = _user_id
$$;

-- Step 2: Drop old campaigner policy that was too permissive (based on agencies instead of assignments)
DROP POLICY IF EXISTS "Campaigners view clients from agencies" ON clients;

-- Step 3: Create new campaigner policy - only see assigned clients via client_team
CREATE POLICY "Campaigners view assigned clients"
  ON clients FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'campaigner'::app_role) 
    AND id = ANY(get_user_client_ids(auth.uid()))
  );

-- Step 4: Remove redundant team manager policy (there's already "Team managers view clients from managed agencies")
DROP POLICY IF EXISTS "Team managers can view clients they manage" ON clients;

-- Step 5: Update the UPDATE policy to restrict campaigners to only update their assigned clients
DROP POLICY IF EXISTS "Users can update clients in their tenants" ON clients;

CREATE POLICY "Users can update clients in their tenants"
  ON clients FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR has_role(auth.uid(), 'sales_person'::app_role)
        OR (has_role(auth.uid(), 'campaigner'::app_role) AND id = ANY(get_user_client_ids(auth.uid())))
      )
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR has_role(auth.uid(), 'sales_person'::app_role)
        OR (has_role(auth.uid(), 'campaigner'::app_role) AND id = ANY(get_user_client_ids(auth.uid())))
      )
    )
  );