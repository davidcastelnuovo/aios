-- AI Detection module tables
-- Stores brand monitoring configuration and scan results

-- Brand configurations per tenant
CREATE TABLE IF NOT EXISTS ai_detection_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  competitor_names TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tracked prompts
CREATE TABLE IF NOT EXISTS ai_detection_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES ai_detection_brands(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'כללי',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Scan results per prompt per platform
CREATE TABLE IF NOT EXISTS ai_detection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES ai_detection_brands(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES ai_detection_prompts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'chatgpt', 'gemini', 'perplexity'
  is_mentioned BOOLEAN NOT NULL DEFAULT false,
  position INTEGER, -- position in the response (1=first, 2=second, etc.)
  sentiment TEXT, -- 'positive', 'neutral', 'negative'
  response_snippet TEXT, -- relevant excerpt from AI response
  citations TEXT[], -- URLs cited in the response
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Competitor scan results
CREATE TABLE IF NOT EXISTS ai_detection_competitor_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES ai_detection_brands(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  prompt_id UUID NOT NULL REFERENCES ai_detection_prompts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  is_mentioned BOOLEAN NOT NULL DEFAULT false,
  position INTEGER,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly visibility scores (aggregated)
CREATE TABLE IF NOT EXISTS ai_detection_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES ai_detection_brands(id) ON DELETE CASCADE,
  score INTEGER NOT NULL, -- 0-100
  chatgpt_score INTEGER,
  gemini_score INTEGER,
  perplexity_score INTEGER,
  total_prompts INTEGER NOT NULL DEFAULT 0,
  mentioned_prompts INTEGER NOT NULL DEFAULT 0,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_detection_brands_tenant ON ai_detection_brands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_detection_prompts_brand ON ai_detection_prompts(brand_id);
CREATE INDEX IF NOT EXISTS idx_ai_detection_results_prompt ON ai_detection_results(prompt_id);
CREATE INDEX IF NOT EXISTS idx_ai_detection_results_scanned ON ai_detection_results(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_detection_scores_brand_week ON ai_detection_scores(brand_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_ai_detection_competitor_results_brand ON ai_detection_competitor_results(brand_id);

-- RLS policies
ALTER TABLE ai_detection_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_detection_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_detection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_detection_competitor_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_detection_scores ENABLE ROW LEVEL SECURITY;

-- Policies: users can access data from their own tenant
CREATE POLICY "Users can view their tenant brands" ON ai_detection_brands
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their tenant brands" ON ai_detection_brands
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their tenant brands" ON ai_detection_brands
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their tenant prompts" ON ai_detection_prompts
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their tenant prompts" ON ai_detection_prompts
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their tenant results" ON ai_detection_results
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can insert results" ON ai_detection_results
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their tenant competitor results" ON ai_detection_competitor_results
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can insert competitor results" ON ai_detection_competitor_results
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their tenant scores" ON ai_detection_scores
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can insert scores" ON ai_detection_scores
  FOR INSERT WITH CHECK (true);
