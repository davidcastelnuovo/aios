-- DMM Agency CRM Adaptation Migration
-- Adds: tier, services, health_score, overall_status, active_flags to clients
-- Creates: communication_logs, seo_monthly_updates tables

-- ============================================================
-- 1. New ENUM types
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.client_tier AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.communication_status AS ENUM ('normal', 'sensitive', 'complaint');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.interaction_type AS ENUM (
    'client_initiated',
    'campaigner_initiated',
    'call',
    'whatsapp',
    'meeting',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.seo_monthly_status AS ENUM ('up', 'stable', 'down');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Extend clients table
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tier public.client_tier DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS overall_status TEXT DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS active_flags JSONB DEFAULT '[]';

-- ============================================================
-- 3. communication_logs table
-- Replaces/extends client_updates for structured communication tracking
-- client_updates is kept for backward compat (free-text notes)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status public.communication_status NOT NULL DEFAULT 'normal',
  interaction_type public.interaction_type NOT NULL DEFAULT 'other',
  note TEXT NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_logs_client
  ON public.communication_logs(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_logs_tenant
  ON public.communication_logs(tenant_id, created_at DESC);

-- ============================================================
-- 4. seo_monthly_updates table
-- Manual monthly SEO status entry per client
-- ============================================================

CREATE TABLE IF NOT EXISTS public.seo_monthly_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  status public.seo_monthly_status NOT NULL,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, month)
);

CREATE INDEX IF NOT EXISTS idx_seo_monthly_updates_client
  ON public.seo_monthly_updates(client_id, month DESC);

-- ============================================================
-- 5. Row Level Security
-- ============================================================

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_monthly_updates ENABLE ROW LEVEL SECURITY;

-- communication_logs policies
DROP POLICY IF EXISTS "communication_logs_tenant_access" ON public.communication_logs;
CREATE POLICY "communication_logs_tenant_access"
  ON public.communication_logs FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- seo_monthly_updates policies
DROP POLICY IF EXISTS "seo_monthly_updates_tenant_access" ON public.seo_monthly_updates;
CREATE POLICY "seo_monthly_updates_tenant_access"
  ON public.seo_monthly_updates FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );
