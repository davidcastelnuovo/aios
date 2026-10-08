-- Fix marketing RLS: split SELECT (active tenant only) vs INSERT/UPDATE/DELETE (any tenant user belongs to)
-- This fixes the race condition where user_active_tenant hasn't been written yet when ensurePipeline runs.
-- SELECT stays scoped to active tenant (prevents cross-tenant data leakage).
-- INSERT/UPDATE/DELETE allows any tenant the user is a member of (prevents RLS blocking creates).

-- Helper: user belongs to this tenant
-- (used for write policies)
-- We use a subquery instead of a function to avoid SECURITY DEFINER caching issues.

-- ── marketing_pipelines ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_pipelines_active_tenant" ON public.marketing_pipelines;

CREATE POLICY "marketing_pipelines_select"
  ON public.marketing_pipelines FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_pipelines_write"
  ON public.marketing_pipelines FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_pipelines_update"
  ON public.marketing_pipelines FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_pipelines_delete"
  ON public.marketing_pipelines FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── marketing_pipeline_stages ────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_pipeline_stages_active_tenant" ON public.marketing_pipeline_stages;

CREATE POLICY "marketing_pipeline_stages_select"
  ON public.marketing_pipeline_stages FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_pipeline_stages_write"
  ON public.marketing_pipeline_stages FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_pipeline_stages_update"
  ON public.marketing_pipeline_stages FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_pipeline_stages_delete"
  ON public.marketing_pipeline_stages FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── marketing_work_items ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_work_items_active_tenant" ON public.marketing_work_items;

CREATE POLICY "marketing_work_items_select"
  ON public.marketing_work_items FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_work_items_write"
  ON public.marketing_work_items FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_work_items_update"
  ON public.marketing_work_items FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_work_items_delete"
  ON public.marketing_work_items FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── marketing_runs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_runs_active_tenant" ON public.marketing_runs;

CREATE POLICY "marketing_runs_select"
  ON public.marketing_runs FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_runs_write"
  ON public.marketing_runs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_runs_update"
  ON public.marketing_runs FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_runs_delete"
  ON public.marketing_runs FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── marketing_assets ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_assets_active_tenant" ON public.marketing_assets;

CREATE POLICY "marketing_assets_select"
  ON public.marketing_assets FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_assets_write"
  ON public.marketing_assets FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_assets_update"
  ON public.marketing_assets FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_assets_delete"
  ON public.marketing_assets FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── marketing_stage_templates ────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_stage_templates_active_tenant" ON public.marketing_stage_templates;

CREATE POLICY "marketing_stage_templates_select"
  ON public.marketing_stage_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_stage_templates_write"
  ON public.marketing_stage_templates FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_stage_templates_update"
  ON public.marketing_stage_templates FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_stage_templates_delete"
  ON public.marketing_stage_templates FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── marketing_media_library ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_media_library_active_tenant" ON public.marketing_media_library;

CREATE POLICY "marketing_media_library_select"
  ON public.marketing_media_library FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_media_library_write"
  ON public.marketing_media_library FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_media_library_update"
  ON public.marketing_media_library FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_media_library_delete"
  ON public.marketing_media_library FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── marketing_item_transitions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_item_transitions_active_tenant" ON public.marketing_item_transitions;

CREATE POLICY "marketing_item_transitions_select"
  ON public.marketing_item_transitions FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_item_transitions_write"
  ON public.marketing_item_transitions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_item_transitions_update"
  ON public.marketing_item_transitions FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_item_transitions_delete"
  ON public.marketing_item_transitions FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── marketing_triggers ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketing_triggers_active_tenant" ON public.marketing_triggers;

CREATE POLICY "marketing_triggers_select"
  ON public.marketing_triggers FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_triggers_write"
  ON public.marketing_triggers FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_triggers_update"
  ON public.marketing_triggers FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "marketing_triggers_delete"
  ON public.marketing_triggers FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
