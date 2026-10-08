
-- 1. Pages connected to clients
CREATE TABLE public.social_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  page_id text NOT NULL,
  page_name text,
  page_access_token text,
  ig_business_id text,
  category text,
  picture_url text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform, page_id)
);
CREATE INDEX idx_social_pages_tenant ON public.social_pages(tenant_id);
CREATE INDEX idx_social_pages_client ON public.social_pages(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_pages TO authenticated;
GRANT ALL ON public.social_pages TO service_role;
ALTER TABLE public.social_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant social_pages select" ON public.social_pages FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "tenant social_pages modify" ON public.social_pages FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER social_pages_set_updated_at BEFORE UPDATE ON public.social_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Publications log
CREATE TABLE public.social_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  page_id uuid REFERENCES public.social_pages(id) ON DELETE SET NULL,
  platform text NOT NULL,
  post_type text NOT NULL CHECK (post_type IN ('post', 'photo', 'video', 'reel', 'story', 'link')),
  caption text,
  media_url text,
  external_id text,
  permalink text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed')),
  error_message text,
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_pub_tenant ON public.social_publications(tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_publications TO authenticated;
GRANT ALL ON public.social_publications TO service_role;
ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant social_pub select" ON public.social_publications FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "tenant social_pub modify" ON public.social_publications FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER social_pub_set_updated_at BEFORE UPDATE ON public.social_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Incoming comments
CREATE TABLE public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid,
  page_id uuid REFERENCES public.social_pages(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_comment_id text NOT NULL,
  external_post_id text,
  parent_comment_id text,
  author_id text,
  author_name text,
  message text,
  is_from_page boolean DEFAULT false,
  sentiment text,
  replied_at timestamptz,
  reply_text text,
  hidden_at timestamptz,
  created_at_external timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_comment_id)
);
CREATE INDEX idx_social_comments_tenant_open ON public.social_comments(tenant_id, replied_at, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_comments TO authenticated;
GRANT ALL ON public.social_comments TO service_role;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant social_comments select" ON public.social_comments FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "tenant social_comments modify" ON public.social_comments FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER social_comments_set_updated_at BEFORE UPDATE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for social-media bucket (auth users can upload/read their tenant's media)
CREATE POLICY "social-media authenticated read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'social-media');
CREATE POLICY "social-media authenticated insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media');
CREATE POLICY "social-media authenticated delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'social-media');
