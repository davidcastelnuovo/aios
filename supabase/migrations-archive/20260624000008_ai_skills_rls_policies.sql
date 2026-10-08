-- Restore RLS policies on ai_skills. The table had RLS ENABLED but ZERO policies
-- in production, so authenticated users (frontend) saw no skins at all while the
-- service role (edge functions) saw everything. This restores intended access:
--   read:  global skins (everyone) + own tenant skins + super admin
--   write: own tenant skins (tenant members) + global skins (super admin only)

DROP POLICY IF EXISTS ai_skills_select ON public.ai_skills;
CREATE POLICY ai_skills_select ON public.ai_skills
  FOR SELECT TO authenticated
  USING (
    scope = 'global'
    OR tenant_id = public.get_effective_tenant_id()
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS ai_skills_tenant_write ON public.ai_skills;
CREATE POLICY ai_skills_tenant_write ON public.ai_skills
  FOR ALL TO authenticated
  USING (scope = 'tenant' AND tenant_id = public.get_effective_tenant_id())
  WITH CHECK (scope = 'tenant' AND tenant_id = public.get_effective_tenant_id());

DROP POLICY IF EXISTS ai_skills_superadmin ON public.ai_skills;
CREATE POLICY ai_skills_superadmin ON public.ai_skills
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
