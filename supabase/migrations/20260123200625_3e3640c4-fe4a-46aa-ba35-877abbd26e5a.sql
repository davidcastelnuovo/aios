-- ============================================
-- RANK TRACKING SYSTEM - Database Schema
-- ============================================

-- 1. Projects Table - SEO projects per client/domain
CREATE TABLE public.rank_tracking_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'il',
  language TEXT NOT NULL DEFAULT 'he',
  device TEXT NOT NULL DEFAULT 'desktop' CHECK (device IN ('desktop', 'mobile', 'tablet')),
  check_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (check_frequency IN ('daily', 'weekly', 'manual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Keywords Table - Keywords to track per project
CREATE TABLE public.rank_tracking_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.rank_tracking_projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  target_url TEXT,
  current_position INTEGER,
  previous_position INTEGER,
  best_position INTEGER,
  worst_position INTEGER,
  position_change INTEGER DEFAULT 0,
  found_url TEXT,
  search_volume INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, keyword)
);

-- 3. History Table - Historical position data
CREATE TABLE public.rank_tracking_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id UUID NOT NULL REFERENCES public.rank_tracking_keywords(id) ON DELETE CASCADE,
  position INTEGER,
  url_found TEXT,
  serp_features JSONB DEFAULT '[]'::jsonb,
  competitors_data JSONB DEFAULT '[]'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Competitors Table - Competitor domains to track
CREATE TABLE public.rank_tracking_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.rank_tracking_projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, domain)
);

-- 5. Alerts Table - Alert configurations
CREATE TABLE public.rank_tracking_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.rank_tracking_projects(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('position_drop', 'position_gain', 'left_top10', 'entered_top10', 'competitor_overtake')),
  threshold INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT false,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Alert Logs Table - History of triggered alerts
CREATE TABLE public.rank_tracking_alert_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.rank_tracking_alerts(id) ON DELETE CASCADE,
  keyword_id UUID REFERENCES public.rank_tracking_keywords(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  old_position INTEGER,
  new_position INTEGER,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES for performance
-- ============================================

CREATE INDEX idx_rank_projects_tenant ON public.rank_tracking_projects(tenant_id);
CREATE INDEX idx_rank_projects_client ON public.rank_tracking_projects(client_id);
CREATE INDEX idx_rank_keywords_project ON public.rank_tracking_keywords(project_id);
CREATE INDEX idx_rank_history_keyword ON public.rank_tracking_history(keyword_id);
CREATE INDEX idx_rank_history_checked_at ON public.rank_tracking_history(checked_at DESC);
CREATE INDEX idx_rank_competitors_project ON public.rank_tracking_competitors(project_id);
CREATE INDEX idx_rank_alerts_project ON public.rank_tracking_alerts(project_id);

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.rank_tracking_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_tracking_alert_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Projects policies
CREATE POLICY "Users can view rank tracking projects in their tenant"
ON public.rank_tracking_projects FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can create rank tracking projects in their tenant"
ON public.rank_tracking_projects FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can update rank tracking projects in their tenant"
ON public.rank_tracking_projects FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete rank tracking projects in their tenant"
ON public.rank_tracking_projects FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);

-- Keywords policies (through project)
CREATE POLICY "Users can view keywords through project"
ON public.rank_tracking_keywords FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_projects p
    WHERE p.id = project_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Users can create keywords through project"
ON public.rank_tracking_keywords FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_projects p
    WHERE p.id = project_id
    AND p.tenant_id = get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "Users can update keywords through project"
ON public.rank_tracking_keywords FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_projects p
    WHERE p.id = project_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Users can delete keywords through project"
ON public.rank_tracking_keywords FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_projects p
    WHERE p.id = project_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

-- History policies (through keyword->project)
CREATE POLICY "Users can view history through project"
ON public.rank_tracking_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_keywords k
    JOIN public.rank_tracking_projects p ON p.id = k.project_id
    WHERE k.id = keyword_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Users can create history through project"
ON public.rank_tracking_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_keywords k
    JOIN public.rank_tracking_projects p ON p.id = k.project_id
    WHERE k.id = keyword_id
    AND p.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Competitors policies
CREATE POLICY "Users can view competitors through project"
ON public.rank_tracking_competitors FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_projects p
    WHERE p.id = project_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage competitors through project"
ON public.rank_tracking_competitors FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_projects p
    WHERE p.id = project_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

-- Alerts policies
CREATE POLICY "Users can view alerts through project"
ON public.rank_tracking_alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_projects p
    WHERE p.id = project_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage alerts through project"
ON public.rank_tracking_alerts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_projects p
    WHERE p.id = project_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

-- Alert logs policies
CREATE POLICY "Users can view alert logs through alert"
ON public.rank_tracking_alert_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rank_tracking_alerts a
    JOIN public.rank_tracking_projects p ON p.id = a.project_id
    WHERE a.id = alert_id
    AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================

CREATE TRIGGER update_rank_projects_updated_at
BEFORE UPDATE ON public.rank_tracking_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rank_keywords_updated_at
BEFORE UPDATE ON public.rank_tracking_keywords
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();