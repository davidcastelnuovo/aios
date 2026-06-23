-- Migration-regression fix (post-Lovable move to project zvoijyneresvkadpprel).
--
-- user_active_tenant lost its PRIMARY KEY (user_id) and FOREIGN KEY (tenant_id)
-- during the migration. Without the unique PK on user_id, the app's
-- upsert(..., { onConflict: 'user_id' }) in TenantContext fails, so the
-- active-tenant pointer can never be persisted. Restores both constraints
-- (guarded so the migration is idempotent).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_active_tenant_pkey') THEN
    ALTER TABLE public.user_active_tenant
      ADD CONSTRAINT user_active_tenant_pkey PRIMARY KEY (user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_active_tenant_tenant_id_fkey') THEN
    ALTER TABLE public.user_active_tenant
      ADD CONSTRAINT user_active_tenant_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
