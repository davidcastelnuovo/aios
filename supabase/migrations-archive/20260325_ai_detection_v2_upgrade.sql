-- Add url and description columns to ai_detection_brands (projects)
ALTER TABLE ai_detection_brands ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE ai_detection_brands ADD COLUMN IF NOT EXISTS description TEXT;

-- Add scan_id to group results by scan run
ALTER TABLE ai_detection_results ADD COLUMN IF NOT EXISTS scan_id TEXT;
ALTER TABLE ai_detection_competitor_results ADD COLUMN IF NOT EXISTS scan_id TEXT;

-- Add unique constraint for weekly scores upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_detection_scores_brand_week_unique'
  ) THEN
    ALTER TABLE ai_detection_scores ADD CONSTRAINT ai_detection_scores_brand_week_unique UNIQUE (brand_id, week_start);
  END IF;
END $$;

-- Add delete policy for brands (so users can delete projects)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their tenant brands'
  ) THEN
    CREATE POLICY "Users can delete their tenant brands" ON ai_detection_brands
      FOR DELETE USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Add delete policy for prompts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their tenant prompts'
  ) THEN
    CREATE POLICY "Users can delete their tenant prompts" ON ai_detection_prompts
      FOR DELETE USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Add update policy for prompts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their tenant prompts'
  ) THEN
    CREATE POLICY "Users can update their tenant prompts" ON ai_detection_prompts
      FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Index for scan_id
CREATE INDEX IF NOT EXISTS idx_ai_detection_results_scan_id ON ai_detection_results(scan_id);
