-- Mirror of 20260805140000_owners_view_shared_agencies.sql for Management API apply.

DROP POLICY IF EXISTS "Owners view all agencies in tenant" ON public.agencies;
CREATE POLICY "Owners view all agencies in tenant"
ON public.agencies
FOR SELECT
USING (
  (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'agency_owner'::app_role)
  )
  AND (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.user_has_cross_tenant_agency_access(auth.uid(), id)
  )
);

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'claude',
  'rls_owners_view_shared_agencies',
  'agencies',
  jsonb_build_object(
    'rule', 'owners/agency_owners SELECT agencies via agency_tenant_access',
    'example', 'MarketingCaptain can pick DMM-MC in Facebook table dialog'
  )
);
