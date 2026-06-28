-- Fix marketing RLS policies to use get_user_tenant_id() (active tenant only)
-- instead of tenant_users subquery (which returns ALL tenants the user belongs to).
-- This prevents cross-tenant data leakage for users who belong to multiple tenants.

-- ── marketing_pipelines ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_pipelines" ON public.marketing_pipelines;

CREATE POLICY "marketing_pipelines_active_tenant"
  ON public.marketing_pipelines
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── marketing_pipeline_stages ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_pipeline_stages" ON public.marketing_pipeline_stages;

CREATE POLICY "marketing_pipeline_stages_active_tenant"
  ON public.marketing_pipeline_stages
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── marketing_work_items ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_work_items" ON public.marketing_work_items;

CREATE POLICY "marketing_work_items_active_tenant"
  ON public.marketing_work_items
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── marketing_runs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_runs" ON public.marketing_runs;
DROP POLICY IF EXISTS "marketing_runs_tenant_isolation" ON public.marketing_runs;

CREATE POLICY "marketing_runs_active_tenant"
  ON public.marketing_runs
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── marketing_assets ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_assets" ON public.marketing_assets;
DROP POLICY IF EXISTS "marketing_assets_tenant_isolation" ON public.marketing_assets;

CREATE POLICY "marketing_assets_active_tenant"
  ON public.marketing_assets
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── marketing_stage_templates ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_stage_templates" ON public.marketing_stage_templates;
DROP POLICY IF EXISTS "marketing_stage_templates_tenant_isolation" ON public.marketing_stage_templates;

CREATE POLICY "marketing_stage_templates_active_tenant"
  ON public.marketing_stage_templates
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── marketing_media_library ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_media_library" ON public.marketing_media_library;
DROP POLICY IF EXISTS "marketing_media_library_tenant_isolation" ON public.marketing_media_library;

CREATE POLICY "marketing_media_library_active_tenant"
  ON public.marketing_media_library
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── marketing_item_transitions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_item_transitions" ON public.marketing_item_transitions;
DROP POLICY IF EXISTS "marketing_item_transitions_tenant_isolation" ON public.marketing_item_transitions;

CREATE POLICY "marketing_item_transitions_active_tenant"
  ON public.marketing_item_transitions
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ── marketing_triggers ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_triggers" ON public.marketing_triggers;
DROP POLICY IF EXISTS "marketing_triggers_tenant_isolation" ON public.marketing_triggers;

CREATE POLICY "marketing_triggers_active_tenant"
  ON public.marketing_triggers
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
