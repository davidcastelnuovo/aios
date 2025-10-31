-- Create function to check if user is SEO staff
CREATE OR REPLACE FUNCTION public.is_seo_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.campaigners c ON c.id = p.campaigner_id
    WHERE p.id = _user_id
      AND c.role @> ARRAY['SEO']::text[]
      AND NOT (c.role @> ARRAY['קמפיינר']::text[] OR c.role @> ARRAY['מנהל צוות']::text[])
  )
$$;

-- Update the RLS policy for SEO staff to see only SEO clients
DROP POLICY IF EXISTS "Campaigners can view clients from their agencies" ON public.clients;

CREATE POLICY "Campaigners can view clients from their agencies" 
ON public.clients 
FOR SELECT 
USING (
  is_super_admin(auth.uid()) OR 
  (
    (tenant_id = get_user_tenant_id(auth.uid())) AND 
    (
      -- Pure SEO staff see only SEO clients
      (is_seo_staff(auth.uid()) AND is_seo_client = true AND agency_id = ANY (get_user_agency_ids(auth.uid()))) OR
      -- Other campaigners (non-pure-SEO) see all clients from their agencies
      (NOT is_seo_staff(auth.uid()) AND agency_id = ANY (get_user_agency_ids(auth.uid())))
    )
  )
);