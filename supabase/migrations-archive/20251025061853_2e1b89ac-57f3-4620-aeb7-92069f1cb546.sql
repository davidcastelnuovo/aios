-- Create function to get user's sales_person_id
CREATE OR REPLACE FUNCTION public.get_user_sales_person_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT sales_person_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- Drop existing overly permissive policies on leads
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;

-- Create new granular policies for leads

-- SELECT: Owners see all, sales people see their leads, campaigners see leads from their agencies
CREATE POLICY "Owners can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Sales people can view their leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  sales_person_id = public.get_user_sales_person_id(auth.uid())
);

CREATE POLICY "Campaigners can view leads from their agencies"
ON public.leads
FOR SELECT
TO authenticated
USING (
  agency_id = ANY(public.get_user_agency_ids(auth.uid()))
);

-- INSERT: Owners can insert all, sales people can insert leads assigned to them, campaigners can insert for their agencies
CREATE POLICY "Owners can insert all leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Sales people can insert their leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  sales_person_id = public.get_user_sales_person_id(auth.uid())
);

CREATE POLICY "Campaigners can insert leads for their agencies"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  agency_id = ANY(public.get_user_agency_ids(auth.uid()))
);

-- UPDATE: Owners can update all, sales people can update their leads, campaigners can update leads from their agencies
CREATE POLICY "Owners can update all leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Sales people can update their leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  sales_person_id = public.get_user_sales_person_id(auth.uid())
);

CREATE POLICY "Campaigners can update leads from their agencies"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  agency_id = ANY(public.get_user_agency_ids(auth.uid()))
);

-- DELETE: Only owners can delete
CREATE POLICY "Owners can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));