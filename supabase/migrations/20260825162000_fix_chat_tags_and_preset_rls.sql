-- chat_tags / chat_contact_tags / lead_filter_presets writes were locked to
-- get_user_tenant_id() (home / stale user_active_tenant). Switching org in
-- the UI lets the client insert the current tenant_id while RLS still checks
-- the previous one, so creating a tag fails.
--
-- Align with get_effective_tenant_id() + membership. This matches the
-- existing "Users can manage tags in their tenant" intent (any member, not
-- owner-only) — it does not grant a new role. Do NOT combine has_role(owner)
-- with get_effective_tenant_id(); has_role checks the home tenant.

DROP POLICY IF EXISTS "Owners can manage tags in their tenant" ON public.chat_tags;
DROP POLICY IF EXISTS "Users can manage tags in their tenant" ON public.chat_tags;
DROP POLICY IF EXISTS "Users can view tags in their tenant" ON public.chat_tags;

CREATE POLICY "Users can view tags in their tenant"
ON public.chat_tags
FOR SELECT
USING (
  tenant_id = public.get_effective_tenant_id()
  OR public.user_is_tenant_member(tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can manage tags in their tenant"
ON public.chat_tags
FOR ALL
USING (
  tenant_id = public.get_effective_tenant_id()
  OR public.user_is_tenant_member(tenant_id)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_effective_tenant_id()
  OR public.user_is_tenant_member(tenant_id)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view tenant presets" ON public.lead_filter_presets;
DROP POLICY IF EXISTS "Users can insert their own presets" ON public.lead_filter_presets;
DROP POLICY IF EXISTS "Users can update their own presets" ON public.lead_filter_presets;
DROP POLICY IF EXISTS "Users can delete their own presets" ON public.lead_filter_presets;

CREATE POLICY "Users can view tenant presets"
ON public.lead_filter_presets
FOR SELECT
USING (
  tenant_id = public.get_effective_tenant_id()
  OR public.user_is_tenant_member(tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert their own presets"
ON public.lead_filter_presets
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    tenant_id = public.get_effective_tenant_id()
    OR public.user_is_tenant_member(tenant_id)
    OR public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "Users can update their own presets"
ON public.lead_filter_presets
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    tenant_id = public.get_effective_tenant_id()
    OR public.user_is_tenant_member(tenant_id)
    OR public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "Users can delete their own presets"
ON public.lead_filter_presets
FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users and admins can manage contact tags" ON public.chat_contact_tags;
DROP POLICY IF EXISTS "Users can view contact tags in their tenant" ON public.chat_contact_tags;

CREATE POLICY "Users can view contact tags in their tenant"
ON public.chat_contact_tags
FOR SELECT
USING (
  tenant_id = public.get_effective_tenant_id()
  OR public.user_is_tenant_member(tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users and admins can manage contact tags"
ON public.chat_contact_tags
FOR ALL
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.get_effective_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = chat_contact_tags.tenant_id
        AND ur.role IN ('owner'::app_role, 'agency_owner'::app_role, 'team_manager'::app_role)
    )
  )
)
WITH CHECK (
  tenant_id = public.get_effective_tenant_id()
  OR public.user_is_tenant_member(tenant_id)
  OR public.is_super_admin(auth.uid())
);
