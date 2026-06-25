-- Stage 0: DB support for "Create Organization for Client"
-- Adds sharing junction tables for social_pages and wordpress_sites,
-- and fixes missing RLS policies so tenant members can read their data.

-- ─── social_pages: add missing primary key ──────────────────────────────────
-- The table was created without a PK; add it so we can reference it.
ALTER TABLE public.social_pages ADD PRIMARY KEY (id);

-- ─── social_pages_shared_tenants ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_pages_shared_tenants (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  social_page_id uuid        NOT NULL REFERENCES public.social_pages(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL REFERENCES public.tenants(id)      ON DELETE CASCADE,
  shared_by      uuid        REFERENCES auth.users(id),
  shared_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (social_page_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_spst_page   ON public.social_pages_shared_tenants (social_page_id);
CREATE INDEX IF NOT EXISTS idx_spst_tenant ON public.social_pages_shared_tenants (tenant_id);

ALTER TABLE public.social_pages_shared_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_manage_spst" ON public.social_pages_shared_tenants
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );


-- ─── wordpress_sites_shared_tenants ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wordpress_sites_shared_tenants (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id   uuid        NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  tenant_id uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shared_by uuid        REFERENCES auth.users(id),
  shared_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_wsst_site   ON public.wordpress_sites_shared_tenants (site_id);
CREATE INDEX IF NOT EXISTS idx_wsst_tenant ON public.wordpress_sites_shared_tenants (tenant_id);

ALTER TABLE public.wordpress_sites_shared_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_manage_wsst" ON public.wordpress_sites_shared_tenants
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );


-- ─── social_pages: add SELECT policy ───────────────────────────────────────
-- RLS is enabled but no policies existed → nobody could read via client.
-- Grant SELECT to own-tenant members and to members of any tenant the page is shared with.
CREATE POLICY "social_pages_tenant_select" ON public.social_pages
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.social_pages_shared_tenants sp
      WHERE sp.social_page_id = id
        AND sp.tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
    )
  );


-- ─── social_media_wordpress_sites: extend SELECT to shared tenants ──────────
-- Existing "Tenant isolation" policy (FOR ALL) covers own-tenant.
-- Add a SELECT-only policy for shared access via the junction table.
CREATE POLICY "wordpress_sites_shared_select" ON public.social_media_wordpress_sites
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.wordpress_sites_shared_tenants ws
      WHERE ws.site_id = id
        AND ws.tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
    )
  );


-- ─── tenant_integrations: add tenant-based SELECT policy ───────────────────
-- Existing policies only let the creating user see rows. Mirror rows (shared
-- integrations with shared_from_integration_id set) need to be visible to
-- all members of the target tenant.
CREATE POLICY "tenant_members_view_integrations" ON public.tenant_integrations
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );
