-- Site Analytics System

-- 1. Tracking configurations per client
CREATE TABLE public.site_tracking_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  tracking_id TEXT NOT NULL UNIQUE,
  website_domain TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{"track_scroll": true, "track_forms": true, "track_clicks": true, "track_outbound": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Site visitors (anonymous fingerprinting)
CREATE TABLE public.site_visitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_config_id UUID NOT NULL REFERENCES public.site_tracking_configs(id) ON DELETE CASCADE,
  visitor_fingerprint TEXT NOT NULL,
  first_visit TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_visit TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  visit_count INTEGER DEFAULT 1,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id_ref UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  first_utm JSONB,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tracking_config_id, visitor_fingerprint)
);

-- 3. Site sessions
CREATE TABLE public.site_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES public.site_visitors(id) ON DELETE CASCADE,
  tracking_config_id UUID NOT NULL REFERENCES public.site_tracking_configs(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  referrer TEXT,
  landing_page TEXT,
  exit_page TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,
  country TEXT,
  city TEXT,
  is_bounce BOOLEAN DEFAULT false,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Site pageviews
CREATE TABLE public.site_pageviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.site_sessions(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES public.site_visitors(id) ON DELETE CASCADE,
  tracking_config_id UUID NOT NULL REFERENCES public.site_tracking_configs(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  page_path TEXT,
  page_title TEXT,
  time_on_page INTEGER DEFAULT 0,
  scroll_depth INTEGER DEFAULT 0,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  tenant_id UUID NOT NULL
);

-- 5. Site events
CREATE TABLE public.site_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.site_sessions(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES public.site_visitors(id) ON DELETE CASCADE,
  tracking_config_id UUID NOT NULL REFERENCES public.site_tracking_configs(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_category TEXT,
  event_label TEXT,
  event_value NUMERIC,
  event_data JSONB,
  page_url TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tenant_id UUID NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.site_tracking_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pageviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for site_tracking_configs
CREATE POLICY "Users can view tracking configs in their tenant"
ON public.site_tracking_configs FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert tracking configs in their tenant"
ON public.site_tracking_configs FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update tracking configs in their tenant"
ON public.site_tracking_configs FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can delete tracking configs in their tenant"
ON public.site_tracking_configs FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- RLS Policies for site_visitors
CREATE POLICY "Users can view visitors in their tenant"
ON public.site_visitors FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Service role can insert visitors"
ON public.site_visitors FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update visitors"
ON public.site_visitors FOR UPDATE
USING (true);

-- RLS Policies for site_sessions
CREATE POLICY "Users can view sessions in their tenant"
ON public.site_sessions FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Service role can insert sessions"
ON public.site_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update sessions"
ON public.site_sessions FOR UPDATE
USING (true);

-- RLS Policies for site_pageviews
CREATE POLICY "Users can view pageviews in their tenant"
ON public.site_pageviews FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Service role can insert pageviews"
ON public.site_pageviews FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update pageviews"
ON public.site_pageviews FOR UPDATE
USING (true);

-- RLS Policies for site_events
CREATE POLICY "Users can view events in their tenant"
ON public.site_events FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Service role can insert events"
ON public.site_events FOR INSERT
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_site_tracking_configs_client ON public.site_tracking_configs(client_id);
CREATE INDEX idx_site_tracking_configs_tracking_id ON public.site_tracking_configs(tracking_id);
CREATE INDEX idx_site_tracking_configs_tenant ON public.site_tracking_configs(tenant_id);

CREATE INDEX idx_site_visitors_tracking_config ON public.site_visitors(tracking_config_id);
CREATE INDEX idx_site_visitors_fingerprint ON public.site_visitors(visitor_fingerprint);
CREATE INDEX idx_site_visitors_lead ON public.site_visitors(lead_id);
CREATE INDEX idx_site_visitors_tenant ON public.site_visitors(tenant_id);

CREATE INDEX idx_site_sessions_visitor ON public.site_sessions(visitor_id);
CREATE INDEX idx_site_sessions_tracking_config ON public.site_sessions(tracking_config_id);
CREATE INDEX idx_site_sessions_started_at ON public.site_sessions(started_at);
CREATE INDEX idx_site_sessions_tenant ON public.site_sessions(tenant_id);

CREATE INDEX idx_site_pageviews_session ON public.site_pageviews(session_id);
CREATE INDEX idx_site_pageviews_visitor ON public.site_pageviews(visitor_id);
CREATE INDEX idx_site_pageviews_viewed_at ON public.site_pageviews(viewed_at);
CREATE INDEX idx_site_pageviews_tenant ON public.site_pageviews(tenant_id);

CREATE INDEX idx_site_events_session ON public.site_events(session_id);
CREATE INDEX idx_site_events_visitor ON public.site_events(visitor_id);
CREATE INDEX idx_site_events_name ON public.site_events(event_name);
CREATE INDEX idx_site_events_occurred_at ON public.site_events(occurred_at);
CREATE INDEX idx_site_events_tenant ON public.site_events(tenant_id);

-- Trigger to update updated_at on site_tracking_configs
CREATE TRIGGER update_site_tracking_configs_updated_at
BEFORE UPDATE ON public.site_tracking_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique tracking ID
CREATE OR REPLACE FUNCTION public.generate_tracking_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    new_id := 'mc_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    SELECT COUNT(*) INTO exists_count FROM site_tracking_configs WHERE tracking_id = new_id;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_id;
END;
$$;

-- Trigger to auto-generate tracking_id
CREATE OR REPLACE FUNCTION public.set_tracking_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tracking_id IS NULL THEN
    NEW.tracking_id := generate_tracking_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_tracking_id_trigger
BEFORE INSERT ON public.site_tracking_configs
FOR EACH ROW
EXECUTE FUNCTION public.set_tracking_id();

-- Function to link visitor to lead
CREATE OR REPLACE FUNCTION public.link_visitor_to_lead(
  p_visitor_fingerprint TEXT,
  p_tracking_id TEXT,
  p_lead_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_visitor_id UUID;
  v_tracking_config_id UUID;
BEGIN
  -- Get tracking config
  SELECT id INTO v_tracking_config_id
  FROM site_tracking_configs
  WHERE tracking_id = p_tracking_id;
  
  IF v_tracking_config_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Find and update visitor
  UPDATE site_visitors
  SET lead_id = p_lead_id
  WHERE tracking_config_id = v_tracking_config_id
    AND visitor_fingerprint = p_visitor_fingerprint
  RETURNING id INTO v_visitor_id;
  
  RETURN v_visitor_id;
END;
$$;

-- Function to get visitor journey for a lead
CREATE OR REPLACE FUNCTION public.get_lead_visitor_journey(p_lead_id UUID)
RETURNS TABLE (
  session_id UUID,
  started_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  page_count INTEGER,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  landing_page TEXT,
  device_type TEXT,
  pages JSONB,
  events JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.started_at,
    s.duration_seconds,
    s.page_count,
    s.utm_source,
    s.utm_medium,
    s.utm_campaign,
    s.referrer,
    s.landing_page,
    s.device_type,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'url', pv.page_url,
        'title', pv.page_title,
        'time_on_page', pv.time_on_page,
        'scroll_depth', pv.scroll_depth,
        'viewed_at', pv.viewed_at
      ) ORDER BY pv.viewed_at)
      FROM site_pageviews pv WHERE pv.session_id = s.id),
      '[]'::jsonb
    ) as pages,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'name', e.event_name,
        'category', e.event_category,
        'label', e.event_label,
        'data', e.event_data,
        'occurred_at', e.occurred_at
      ) ORDER BY e.occurred_at)
      FROM site_events e WHERE e.session_id = s.id),
      '[]'::jsonb
    ) as events
  FROM site_sessions s
  JOIN site_visitors v ON s.visitor_id = v.id
  WHERE v.lead_id = p_lead_id
  ORDER BY s.started_at DESC;
END;
$$;