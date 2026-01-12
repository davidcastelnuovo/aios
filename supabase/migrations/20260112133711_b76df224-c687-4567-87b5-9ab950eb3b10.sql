-- Fix the INSERT policy for leads - currently comparing ur.tenant_id = ur.tenant_id instead of leads.tenant_id
DROP POLICY IF EXISTS "Users can create leads in their tenants" ON public.leads;

CREATE POLICY "Users can create leads in their tenants"
ON public.leads
FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = leads.tenant_id
      AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  ))
  OR is_super_admin(auth.uid())
);

-- Also fix the UPDATE policy which has the same bug
DROP POLICY IF EXISTS "Users can update leads in their tenants" ON public.leads;

CREATE POLICY "Users can update leads in their tenants"
ON public.leads
FOR UPDATE
USING (
  (EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = leads.tenant_id
      AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  ))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = leads.tenant_id
      AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  ))
  OR is_super_admin(auth.uid())
);