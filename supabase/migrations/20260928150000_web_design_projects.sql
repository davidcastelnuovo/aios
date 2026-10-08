-- Web design department: landing pages / mini-sites (phase 1: landing)
CREATE TABLE IF NOT EXISTS public.web_design_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  slug text NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'landing' CHECK (kind IN ('landing', 'minisite')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'building', 'preview', 'published', 'failed')),
  reference_url text,
  copy_source text NOT NULL DEFAULT 'manual' CHECK (copy_source IN ('manual', 'copy_department')),
  copy_work_item_id uuid REFERENCES public.marketing_work_items(id) ON DELETE SET NULL,
  copy_snapshot text,
  intake_notes text,
  reference_image_paths text[] NOT NULL DEFAULT '{}',
  build_token text,
  build_version integer NOT NULL DEFAULT 0,
  cursor_agent_id text,
  cursor_session_url text,
  last_build_error text,
  storage_prefix text,
  preview_token text,
  public_url text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS web_design_projects_tenant_client_idx
  ON public.web_design_projects (tenant_id, client_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS web_design_projects_tenant_status_idx
  ON public.web_design_projects (tenant_id, status);

ALTER TABLE public.web_design_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY web_design_projects_select ON public.web_design_projects
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY web_design_projects_insert ON public.web_design_projects
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY web_design_projects_update ON public.web_design_projects
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY web_design_projects_delete ON public.web_design_projects
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_design_projects TO authenticated;
GRANT ALL ON public.web_design_projects TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('web-design-sites', 'web-design-sites', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'web design sites tenant upload'
  ) THEN
    CREATE POLICY "web design sites tenant upload"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'web-design-sites'
        AND (storage.foldername(name))[1] = public.get_effective_tenant_id()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'web design sites tenant read'
  ) THEN
    CREATE POLICY "web design sites tenant read"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'web-design-sites'
        AND (storage.foldername(name))[1] = public.get_effective_tenant_id()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'web design sites service role all'
  ) THEN
    CREATE POLICY "web design sites service role all"
      ON storage.objects FOR ALL TO service_role
      USING (bucket_id = 'web-design-sites')
      WITH CHECK (bucket_id = 'web-design-sites');
  END IF;
END $$;
