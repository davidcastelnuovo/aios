-- Create security definer function to check finance_view permission
CREATE OR REPLACE FUNCTION public.has_finance_permission(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND module = 'finance_view'
      AND can_access = true
  ) OR has_role(_user_id, 'owner'::app_role) OR is_super_admin(_user_id)
$$;

-- Fix finance table - Only users with finance_view permission can access
DROP POLICY IF EXISTS "Users can view finance in their tenant" ON public.finance;
DROP POLICY IF EXISTS "Users can manage finance in their tenant" ON public.finance;

CREATE POLICY "Users with finance permission can view finance"
ON public.finance
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_finance_permission(auth.uid())) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users with finance permission can insert finance"
ON public.finance
FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_finance_permission(auth.uid())) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users with finance permission can update finance"
ON public.finance
FOR UPDATE
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_finance_permission(auth.uid())) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users with finance permission can delete finance"
ON public.finance
FOR DELETE
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_finance_permission(auth.uid())) 
  OR is_super_admin(auth.uid())
);