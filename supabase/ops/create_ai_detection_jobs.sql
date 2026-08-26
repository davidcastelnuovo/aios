-- ChatGPT.com visibility worker jobs. Applied on merge via apply-sql-migration.yml.
-- Browser scans cannot finish inside an edge-function timeout.

CREATE TABLE IF NOT EXISTS public.ai_detection_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.ai_detection_brands(id) ON DELETE CASCADE,
  scan_id text NOT NULL UNIQUE,
  engine text NOT NULL DEFAULT 'chatgpt_web',
  status text NOT NULL DEFAULT 'queued',
  total_prompts integer NOT NULL DEFAULT 0,
  completed_prompts integer NOT NULL DEFAULT 0,
  mentioned_prompts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_detection_jobs_brand
  ON public.ai_detection_jobs(brand_id, created_at DESC);

ALTER TABLE public.ai_detection_jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.ai_detection_jobs TO authenticated;
GRANT ALL ON TABLE public.ai_detection_jobs TO service_role;

DROP POLICY IF EXISTS "Tenant isolation for ai_detection_jobs" ON public.ai_detection_jobs;
DROP POLICY IF EXISTS "Users can view their tenant jobs" ON public.ai_detection_jobs;

CREATE POLICY "Users can view their tenant jobs"
  ON public.ai_detection_jobs
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_users.tenant_id FROM tenant_users WHERE tenant_users.user_id = auth.uid()));
