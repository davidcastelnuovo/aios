-- Tenants that work through a shared agency (agency_tenant_access) were
-- creating leads with agency_id NULL. lead_updates RLS then required
-- campaigner_agencies / owner / sales-person agencies, so even a super admin
-- could see the lead and still fail to add an update. Tasks from the lead
-- card also had no agency to stamp.
--
-- Auto-assign the tenant's home agency (owned default → first owned → first
-- shared-in agency). Align lead_updates with the tenant the user is actually
-- working in, plus super_admin, without granting a new role.

CREATE OR REPLACE FUNCTION public.get_tenant_home_agency_id(_tenant_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM (
    SELECT
      a.id,
      0 AS pri,
      CASE WHEN a.is_default THEN 0 ELSE 1 END AS sec,
      a.created_at
    FROM public.agencies a
    WHERE a.tenant_id = _tenant_id
      AND (a.status IS NULL OR a.status = 'active')
    UNION ALL
    SELECT
      ata.agency_id,
      1 AS pri,
      1 AS sec,
      ata.created_at
    FROM public.agency_tenant_access ata
    JOIN public.agencies a ON a.id = ata.agency_id
    WHERE ata.accessing_tenant_id = _tenant_id
      AND (a.status IS NULL OR a.status = 'active')
  ) x
  ORDER BY pri, sec, created_at
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_tenant_home_agency_id(uuid) IS
  'Owned default agency, else first owned, else first agency shared into the tenant';

CREATE OR REPLACE FUNCTION public.leads_assign_home_agency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.agency_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
    NEW.agency_id := public.get_tenant_home_agency_id(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_assign_home_agency ON public.leads;
CREATE TRIGGER leads_assign_home_agency
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
WHEN (NEW.agency_id IS NULL)
EXECUTE FUNCTION public.leads_assign_home_agency();

UPDATE public.leads l
SET agency_id = public.get_tenant_home_agency_id(l.tenant_id)
WHERE l.agency_id IS NULL
  AND public.get_tenant_home_agency_id(l.tenant_id) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.user_can_annotate_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = _lead_id
      AND (
        public.is_super_admin(auth.uid())
        OR public.has_role(auth.uid(), 'owner')
        OR l.agency_id = ANY (public.get_user_agency_ids(auth.uid()))
        OR l.agency_id = ANY (public.get_user_sales_person_agency_ids(auth.uid()))
        OR public.user_has_cross_tenant_agency_access(auth.uid(), l.agency_id)
        OR (
          l.tenant_id = public.get_effective_tenant_id()
          AND (
            l.agency_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.agency_tenant_access ata
              WHERE ata.agency_id = l.agency_id
                AND ata.accessing_tenant_id = public.get_effective_tenant_id()
            )
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.user_can_annotate_lead(uuid) IS
  'Whether the current user may view/create lead_updates for this lead';

DROP POLICY IF EXISTS "Users can create lead updates" ON public.lead_updates;
CREATE POLICY "Users can create lead updates"
ON public.lead_updates
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND public.user_can_annotate_lead(lead_id)
);

DROP POLICY IF EXISTS "Users can view lead updates" ON public.lead_updates;
CREATE POLICY "Users can view lead updates"
ON public.lead_updates
FOR SELECT
TO public
USING (public.user_can_annotate_lead(lead_id));

GRANT EXECUTE ON FUNCTION public.get_tenant_home_agency_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_annotate_lead(uuid) TO authenticated, service_role;
