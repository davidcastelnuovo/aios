-- Migration: sharing junction tables for "Create Organization for Client"
-- NOTE: social_pages_shared_tenants and wordpress_sites_shared_tenants were already
-- created by an earlier migration with broad ALL policies. This migration file records
-- the fix applied via 20260625170001_fix_shared_pages_rls.sql (see below).
-- Kept for audit trail — the apply_migration calls are idempotent (IF NOT EXISTS / DROP+CREATE).

-- ─── social_pages_shared_tenants ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_pages_shared_tenants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  social_page_id  uuid        NOT NULL REFERENCES public.social_pages(id) ON DELETE CASCADE,
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shared_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (social_page_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_social_pages_shared_page   ON public.social_pages_shared_tenants(social_page_id);
CREATE INDEX IF NOT EXISTS idx_social_pages_shared_tenant ON public.social_pages_shared_tenants(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_pages_shared_tenants TO authenticated;
GRANT ALL ON public.social_pages_shared_tenants TO service_role;
ALTER TABLE public.social_pages_shared_tenants ENABLE ROW LEVEL SECURITY;

-- ─── wordpress_sites_shared_tenants ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wordpress_sites_shared_tenants (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id   uuid        NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  tenant_id uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shared_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_wp_sites_shared_site   ON public.wordpress_sites_shared_tenants(site_id);
CREATE INDEX IF NOT EXISTS idx_wp_sites_shared_tenant ON public.wordpress_sites_shared_tenants(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wordpress_sites_shared_tenants TO authenticated;
GRANT ALL ON public.wordpress_sites_shared_tenants TO service_role;
ALTER TABLE public.wordpress_sites_shared_tenants ENABLE ROW LEVEL SECURITY;
