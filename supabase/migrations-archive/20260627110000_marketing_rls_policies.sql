-- ============================================================
-- Marketing module RLS policies
-- RLS was enabled on all marketing tables but NO policies existed,
-- causing every client-side query to return 0 rows.
-- This migration adds tenant-isolation policies matching the
-- pattern used by social_media_posts.
-- ============================================================

-- ── marketing_pipelines ─────────────────────────────────────
CREATE POLICY "Tenant isolation for marketing_pipelines"
  ON marketing_pipelines FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ── marketing_pipeline_stages ───────────────────────────────
CREATE POLICY "Tenant isolation for marketing_pipeline_stages"
  ON marketing_pipeline_stages FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ── marketing_work_items ────────────────────────────────────
CREATE POLICY "Tenant isolation for marketing_work_items"
  ON marketing_work_items FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- ── marketing_runs ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'marketing_runs' AND relrowsecurity = true
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Tenant isolation for marketing_runs"
        ON marketing_runs FOR ALL
        USING (
          tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
          )
        )
        WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- ── marketing_assets ────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'marketing_assets' AND relrowsecurity = true
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Tenant isolation for marketing_assets"
        ON marketing_assets FOR ALL
        USING (
          tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
          )
        )
        WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- ── marketing_stage_templates ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'marketing_stage_templates' AND relrowsecurity = true
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Tenant isolation for marketing_stage_templates"
        ON marketing_stage_templates FOR ALL
        USING (
          tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
          )
        )
        WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- ── marketing_media_library ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'marketing_media_library' AND relrowsecurity = true
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Tenant isolation for marketing_media_library"
        ON marketing_media_library FOR ALL
        USING (
          tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
          )
        )
        WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;
