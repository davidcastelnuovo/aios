-- Restrict agencies SELECT to roles and assigned agencies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view agencies" ON public.agencies;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Owners can view all agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Campaigners can view their agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (id = ANY(public.get_user_agency_ids(auth.uid())));

CREATE POLICY "Team managers can view managed agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (public.user_manages_agency(auth.uid(), id));

CREATE POLICY "Sales people can view their agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (id = ANY(public.get_user_sales_person_agency_ids(auth.uid())));

-- Restrict clients SELECT similarly
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Owners can view all clients"
ON public.clients
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Campaigners can view clients from their agencies"
ON public.clients
FOR SELECT
TO authenticated
USING (agency_id = ANY(public.get_user_agency_ids(auth.uid())));

CREATE POLICY "Team managers can view clients they manage"
ON public.clients
FOR SELECT
TO authenticated
USING (public.user_manages_agency(auth.uid(), agency_id));

CREATE POLICY "Sales people can view clients from their agencies"
ON public.clients
FOR SELECT
TO authenticated
USING (agency_id = ANY(public.get_user_sales_person_agency_ids(auth.uid())));
