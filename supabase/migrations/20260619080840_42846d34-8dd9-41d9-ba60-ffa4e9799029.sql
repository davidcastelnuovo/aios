
ALTER TABLE public.ai_skills
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS success_rate numeric(4,3) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by_agent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS ai_skills_tenant_active_idx
  ON public.ai_skills (tenant_id, is_active);

CREATE OR REPLACE FUNCTION public.increment_skill_usage(skill_ids uuid[])
RETURNS void AS $$
  UPDATE public.ai_skills
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = ANY(skill_ids);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.increment_skill_usage(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_skill_usage(uuid[]) TO authenticated, service_role;
