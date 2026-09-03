-- Allow tenant owners to update org profile fields (name + slug).
-- Super admins already have a separate UPDATE policy on public.tenants.

DROP POLICY IF EXISTS "Owners can update their tenant profile" ON public.tenants;

CREATE POLICY "Owners can update their tenant profile"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  AND id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
);
