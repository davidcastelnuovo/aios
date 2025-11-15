-- Ensure RLS allows viewing clients from shared agencies
DO $$ BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients'
  ) THEN
    RAISE NOTICE 'clients table not found';
  END IF;
END $$;

-- Policy: Users can view clients in their own tenant (typical)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'Users can view clients in their tenant'
  ) THEN
    CREATE POLICY "Users can view clients in their tenant"
    ON public.clients
    FOR SELECT
    USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));
  END IF;
END $$;

-- Policy: Users can view clients from shared agencies (cross-tenant access)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'Users can view clients from shared agencies'
  ) THEN
    CREATE POLICY "Users can view clients from shared agencies"
    ON public.clients
    FOR SELECT
    USING (is_super_admin(auth.uid()) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id));
  END IF;
END $$;