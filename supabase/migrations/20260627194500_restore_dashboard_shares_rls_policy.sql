-- Same regression as crm_dashboards: the 2026-06-22 stack-cutover rebuild left
-- dashboard_shares RLS-enabled with no policies (default deny), breaking dashboard
-- share-links. Restore the original policy (from 20260325193330).
DROP POLICY IF EXISTS "Users can manage their own shares" ON public.dashboard_shares;
CREATE POLICY "Users can manage their own shares"
  ON public.dashboard_shares FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );
