-- chat_tags / lead_filter_presets writes were locked to get_user_tenant_id()
-- (home / stale user_active_tenant). Switching org in the UI (Promo vs another
-- tenant) lets the client insert the current tenant_id while RLS still checks
-- the previous one, so creating a tag or saving a filter preset fails.
--
-- Align with get_effective_tenant_id() + existing tenant membership. Super
-- admins already operating in another org keep write access. No role elevation.

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

-- Contact-tag writes used the same stale home-tenant check. Keep assignment
-- scoped to the current/effective tenant (or super admin) so chat-view tag
-- filters see tags the team just created.
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
  OR (
    (
      tenant_id = public.get_effective_tenant_id()
      OR public.user_is_tenant_member(tenant_id)
    )
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'agency_owner'::app_role)
      OR public.has_role(auth.uid(), 'team_manager'::app_role)
    )
  )
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_effective_tenant_id()
  OR public.user_is_tenant_member(tenant_id)
  OR public.is_super_admin(auth.uid())
);
