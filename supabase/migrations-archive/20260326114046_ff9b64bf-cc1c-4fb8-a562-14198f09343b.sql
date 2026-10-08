
-- Add missing columns to ai_detection_results
ALTER TABLE public.ai_detection_results 
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.ai_detection_brands(id) ON DELETE CASCADE;

-- Add tenant_id to ai_detection_scores
ALTER TABLE public.ai_detection_scores
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add unique constraint for upsert on scores
ALTER TABLE public.ai_detection_scores
  ADD CONSTRAINT ai_detection_scores_brand_week_unique UNIQUE (brand_id, week_start);

-- Create competitor results table
CREATE TABLE IF NOT EXISTS public.ai_detection_competitor_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.ai_detection_brands(id) ON DELETE CASCADE,
  competitor_name text NOT NULL,
  prompt_id uuid REFERENCES public.ai_detection_prompts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  is_mentioned boolean DEFAULT false,
  position integer,
  scan_id text,
  scanned_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_detection_competitor_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ai_detection_competitor_results"
  ON public.ai_detection_competitor_results
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Update RLS on results to also allow brand_id based access
DROP POLICY IF EXISTS "Tenant isolation for ai_detection_results" ON public.ai_detection_results;
CREATE POLICY "Tenant isolation for ai_detection_results"
  ON public.ai_detection_results
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
