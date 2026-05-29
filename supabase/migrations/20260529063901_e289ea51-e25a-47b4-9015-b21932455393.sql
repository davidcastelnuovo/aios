
-- 1. Helper SECURITY DEFINER functions (bypass RLS to avoid recursion)

CREATE OR REPLACE FUNCTION public.is_automation_shared_to_tenant(_automation_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.automation_shared_tenants
    WHERE automation_id = _automation_id AND tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_user_in_automation_source_tenant(_automation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.automations a
    JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
    WHERE a.id = _automation_id AND tu.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_user_admin_of_automation_source_tenant(_automation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.automations a
    JOIN public.user_roles ur ON ur.tenant_id = a.tenant_id AND ur.user_id = _user_id
    WHERE a.id = _automation_id
      AND ur.role IN ('owner'::app_role, 'team_manager'::app_role, 'agency_owner'::app_role)
  )
$$;

-- 2. Replace recursive policy on automations
DROP POLICY IF EXISTS "Users can view shared mirror automations" ON public.automations;
CREATE POLICY "Users can view shared mirror automations"
ON public.automations
FOR SELECT
TO authenticated
USING (
  public.is_automation_shared_to_tenant(id, public.get_user_tenant_id(auth.uid()))
);

-- 3. Replace recursive policy on automation_flow_steps
DROP POLICY IF EXISTS "Users can view shared mirror flow steps" ON public.automation_flow_steps;
CREATE POLICY "Users can view shared mirror flow steps"
ON public.automation_flow_steps
FOR SELECT
TO authenticated
USING (
  public.is_automation_shared_to_tenant(automation_id, public.get_effective_tenant_id())
);

-- 4. Replace recursive policies on automation_shared_tenants
DROP POLICY IF EXISTS "ast_select_members" ON public.automation_shared_tenants;
CREATE POLICY "ast_select_members"
ON public.automation_shared_tenants
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = automation_shared_tenants.tenant_id
  )
  OR public.is_user_in_automation_source_tenant(automation_id, auth.uid())
);

DROP POLICY IF EXISTS "ast_insert_source_admin" ON public.automation_shared_tenants;
CREATE POLICY "ast_insert_source_admin"
ON public.automation_shared_tenants
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_user_admin_of_automation_source_tenant(automation_id, auth.uid())
);

DROP POLICY IF EXISTS "ast_delete_source_admin" ON public.automation_shared_tenants;
CREATE POLICY "ast_delete_source_admin"
ON public.automation_shared_tenants
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_user_admin_of_automation_source_tenant(automation_id, auth.uid())
);
