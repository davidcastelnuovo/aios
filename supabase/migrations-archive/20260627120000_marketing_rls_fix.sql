-- Fix RLS policies for all marketing tables
-- Previous policies used tenant_users subquery which doesn't work in this schema.
-- The correct pattern uses get_user_tenant_id(auth.uid()) as used by clients, tasks, etc.

-- ── Drop old policies ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for marketing_pipelines" ON marketing_pipelines;
DROP POLICY IF EXISTS "Tenant isolation for marketing_pipeline_stages" ON marketing_pipeline_stages;
DROP POLICY IF EXISTS "Tenant isolation for marketing_work_items" ON marketing_work_items;
DROP POLICY IF EXISTS "Tenant isolation for marketing_runs" ON marketing_runs;
DROP POLICY IF EXISTS "Tenant isolation for marketing_assets" ON marketing_assets;
DROP POLICY IF EXISTS "Tenant isolation for marketing_stage_templates" ON marketing_stage_templates;
DROP POLICY IF EXISTS "Tenant isolation for marketing_media_library" ON marketing_media_library;

-- ── marketing_pipelines ──────────────────────────────────────────────────────
CREATE POLICY "marketing_pipelines_tenant_select" ON marketing_pipelines
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );
CREATE POLICY "marketing_pipelines_tenant_insert" ON marketing_pipelines
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_pipelines_tenant_update" ON marketing_pipelines
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_pipelines_tenant_delete" ON marketing_pipelines
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- ── marketing_pipeline_stages ────────────────────────────────────────────────
CREATE POLICY "marketing_pipeline_stages_tenant_select" ON marketing_pipeline_stages
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );
CREATE POLICY "marketing_pipeline_stages_tenant_insert" ON marketing_pipeline_stages
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_pipeline_stages_tenant_update" ON marketing_pipeline_stages
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_pipeline_stages_tenant_delete" ON marketing_pipeline_stages
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- ── marketing_work_items ─────────────────────────────────────────────────────
CREATE POLICY "marketing_work_items_tenant_select" ON marketing_work_items
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );
CREATE POLICY "marketing_work_items_tenant_insert" ON marketing_work_items
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_work_items_tenant_update" ON marketing_work_items
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_work_items_tenant_delete" ON marketing_work_items
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- ── marketing_runs ───────────────────────────────────────────────────────────
CREATE POLICY "marketing_runs_tenant_select" ON marketing_runs
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );
CREATE POLICY "marketing_runs_tenant_insert" ON marketing_runs
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_runs_tenant_update" ON marketing_runs
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_runs_tenant_delete" ON marketing_runs
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- ── marketing_assets ─────────────────────────────────────────────────────────
CREATE POLICY "marketing_assets_tenant_select" ON marketing_assets
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );
CREATE POLICY "marketing_assets_tenant_insert" ON marketing_assets
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_assets_tenant_update" ON marketing_assets
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_assets_tenant_delete" ON marketing_assets
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- ── marketing_stage_templates ────────────────────────────────────────────────
CREATE POLICY "marketing_stage_templates_tenant_select" ON marketing_stage_templates
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );
CREATE POLICY "marketing_stage_templates_tenant_insert" ON marketing_stage_templates
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_stage_templates_tenant_update" ON marketing_stage_templates
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_stage_templates_tenant_delete" ON marketing_stage_templates
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- ── marketing_media_library ──────────────────────────────────────────────────
CREATE POLICY "marketing_media_library_tenant_select" ON marketing_media_library
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
  );
CREATE POLICY "marketing_media_library_tenant_insert" ON marketing_media_library
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_media_library_tenant_update" ON marketing_media_library
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );
CREATE POLICY "marketing_media_library_tenant_delete" ON marketing_media_library
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );
