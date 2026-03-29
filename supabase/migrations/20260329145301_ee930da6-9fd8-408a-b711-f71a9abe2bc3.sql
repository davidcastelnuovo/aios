-- Social media posts table
CREATE TABLE IF NOT EXISTS public.social_media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid,
  title text,
  content text NOT NULL DEFAULT '',
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  post_type text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  wordpress_post_id text,
  wordpress_site_url text,
  publish_to_wordpress boolean NOT NULL DEFAULT false,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Social media channels table
CREATE TABLE IF NOT EXISTS public.social_media_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform text NOT NULL,
  channel_name text NOT NULL,
  channel_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Post-channel junction table
CREATE TABLE IF NOT EXISTS public.social_media_post_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.social_media_channels(id) ON DELETE CASCADE,
  platform_post_id text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- WordPress sites table
CREATE TABLE IF NOT EXISTS public.social_media_wordpress_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_url text NOT NULL,
  username text NOT NULL,
  app_password text NOT NULL,
  site_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_post_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_wordpress_sites ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_media_posts
CREATE POLICY "tenant_isolation" ON public.social_media_posts
  FOR ALL USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- RLS policies for social_media_channels
CREATE POLICY "tenant_isolation" ON public.social_media_channels
  FOR ALL USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- RLS policies for social_media_post_channels
CREATE POLICY "tenant_isolation" ON public.social_media_post_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.social_media_posts p 
      WHERE p.id = post_id 
      AND (p.tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
    )
  );

-- RLS policies for social_media_wordpress_sites
CREATE POLICY "tenant_isolation" ON public.social_media_wordpress_sites
  FOR ALL USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- Enable realtime for posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_media_posts;