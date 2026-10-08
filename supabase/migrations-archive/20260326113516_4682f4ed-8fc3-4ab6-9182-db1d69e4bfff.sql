
-- AI Detection brands/projects
CREATE TABLE public.ai_detection_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  url text,
  description text,
  keywords text[] DEFAULT '{}',
  competitor_names text[] DEFAULT '{}',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_detection_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ai_detection_brands"
  ON public.ai_detection_brands
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- AI Detection prompts
CREATE TABLE public.ai_detection_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.ai_detection_brands(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  category text DEFAULT 'general',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_detection_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ai_detection_prompts"
  ON public.ai_detection_prompts
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- AI Detection scan results
CREATE TABLE public.ai_detection_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.ai_detection_prompts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  is_mentioned boolean DEFAULT false,
  position integer,
  sentiment text,
  response_snippet text,
  citations text[],
  scan_id text,
  scanned_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_detection_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ai_detection_results"
  ON public.ai_detection_results
  FOR ALL
  TO authenticated
  USING (prompt_id IN (SELECT id FROM public.ai_detection_prompts WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())))
  WITH CHECK (prompt_id IN (SELECT id FROM public.ai_detection_prompts WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())));

-- AI Detection weekly scores
CREATE TABLE public.ai_detection_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.ai_detection_brands(id) ON DELETE CASCADE,
  score numeric DEFAULT 0,
  chatgpt_score numeric,
  gemini_score numeric,
  perplexity_score numeric,
  total_prompts integer DEFAULT 0,
  mentioned_prompts integer DEFAULT 0,
  week_start date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_detection_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ai_detection_scores"
  ON public.ai_detection_scores
  FOR ALL
  TO authenticated
  USING (brand_id IN (SELECT id FROM public.ai_detection_brands WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())))
  WITH CHECK (brand_id IN (SELECT id FROM public.ai_detection_brands WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())));
