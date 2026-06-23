-- Migration-regression fix (post-Lovable move to project zvoijyneresvkadpprel).
--
-- user_active_tenant had RLS ENABLED but ZERO policies in the migrated DB, so the
-- app's authenticated client could neither read nor write a user's active-tenant
-- row. The table stayed empty for every user, and get_user_tenant_id() silently
-- fell back to an arbitrary tenant_users membership -> users resolved to the wrong
-- tenant and all RLS-scoped data (automations, leads, etc.) appeared empty and
-- could not be created.
--
-- Restores the four canonical policies from database/schema.sql.

DROP POLICY IF EXISTS "Super admins see all active_tenant" ON public.user_active_tenant;
DROP POLICY IF EXISTS "Users manage own active tenant" ON public.user_active_tenant;
DROP POLICY IF EXISTS "Users manage own active_tenant" ON public.user_active_tenant;
DROP POLICY IF EXISTS "Users read own active tenant" ON public.user_active_tenant;

CREATE POLICY "Super admins see all active_tenant" ON public.user_active_tenant
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users manage own active tenant" ON public.user_active_tenant
  AS PERMISSIVE FOR ALL TO public
  USING (((auth.uid() = user_id) OR is_super_admin(auth.uid())))
  WITH CHECK (((auth.uid() = user_id) OR is_super_admin(auth.uid())));

CREATE POLICY "Users manage own active_tenant" ON public.user_active_tenant
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users read own active tenant" ON public.user_active_tenant
  AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR is_super_admin(auth.uid())));
