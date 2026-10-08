-- Allow owners to update other users' profiles
CREATE POLICY "Owners can update any profile in their tenant"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'owner'::app_role) 
  AND get_user_tenant_id(id) = get_user_tenant_id(auth.uid())
);