CREATE TABLE IF NOT EXISTS public.social_gantt_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  topic text NOT NULL,
  scheduled_date date NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram','facebook','tiktok','linkedin','twitter')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','rejected')),
  copy_text text,
  creative_url text,
  creative_prompt text,
  copy_prompt text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_social_gantt_posts_tenant ON public.social_gantt_posts(tenant_id);
CREATE INDEX idx_social_gantt_posts_date ON public.social_gantt_posts(scheduled_date);
CREATE INDEX idx_social_gantt_posts_status ON public.social_gantt_posts(status);

ALTER TABLE public.social_gantt_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_tenant" ON public.social_gantt_posts FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "insert_own_tenant" ON public.social_gantt_posts FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "update_own_tenant" ON public.social_gantt_posts FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "delete_own_tenant" ON public.social_gantt_posts FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));