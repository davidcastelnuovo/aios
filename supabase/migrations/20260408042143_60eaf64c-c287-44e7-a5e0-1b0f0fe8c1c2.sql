
-- Create enum types if they don't exist
DO $$ BEGIN
  CREATE TYPE public.client_tier AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.communication_status AS ENUM ('normal', 'sensitive', 'complaint');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.interaction_type AS ENUM ('client_initiated', 'campaigner_initiated', 'call', 'whatsapp', 'meeting', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.seo_monthly_status AS ENUM ('up', 'stable', 'down');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tier public.client_tier DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS overall_status TEXT DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS active_flags JSONB DEFAULT '[]';

-- Create seo_monthly_updates table
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

CREATE INDEX IF NOT EXISTS idx_seo_monthly_updates_client ON public.seo_monthly_updates(client_id, month DESC);

-- Enable RLS on seo_monthly_updates
ALTER TABLE public.seo_monthly_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_monthly_updates_tenant_access" ON public.seo_monthly_updates;
CREATE POLICY "seo_monthly_updates_tenant_access" ON public.seo_monthly_updates FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Add additional RLS policy for communication_logs (tenant_users based)
DROP POLICY IF EXISTS "communication_logs_tenant_access" ON public.communication_logs;
CREATE POLICY "communication_logs_tenant_access" ON public.communication_logs FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
