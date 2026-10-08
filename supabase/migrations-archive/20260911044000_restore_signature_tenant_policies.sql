-- Restore tenant policies that are present in Staging but missing in Production.
-- These are the original authenticated policies from 20260308075740.
-- Preserve existing policies and keep public signing behind document-bound tokens.
DO $restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signature_documents'
      AND policyname = 'Users can view documents in their tenant'
  ) THEN
    CREATE POLICY "Users can view documents in their tenant"
      ON public.signature_documents FOR SELECT TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signature_documents'
      AND policyname = 'Users can create documents in their tenant'
  ) THEN
    CREATE POLICY "Users can create documents in their tenant"
      ON public.signature_documents FOR INSERT TO authenticated
      WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signature_documents'
      AND policyname = 'Users can update documents in their tenant'
  ) THEN
    CREATE POLICY "Users can update documents in their tenant"
      ON public.signature_documents FOR UPDATE TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signature_documents'
      AND policyname = 'Users can delete documents in their tenant'
  ) THEN
    CREATE POLICY "Users can delete documents in their tenant"
      ON public.signature_documents FOR DELETE TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signature_recipients'
      AND policyname = 'Users can view recipients in their tenant'
  ) THEN
    CREATE POLICY "Users can view recipients in their tenant"
      ON public.signature_recipients FOR SELECT TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signature_recipients'
      AND policyname = 'Users can manage recipients in their tenant'
  ) THEN
    CREATE POLICY "Users can manage recipients in their tenant"
      ON public.signature_recipients FOR INSERT TO authenticated
      WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signature_recipients'
      AND policyname = 'Users can update recipients in their tenant'
  ) THEN
    CREATE POLICY "Users can update recipients in their tenant"
      ON public.signature_recipients FOR UPDATE TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signature_recipients'
      AND policyname = 'Users can delete recipients in their tenant'
  ) THEN
    CREATE POLICY "Users can delete recipients in their tenant"
      ON public.signature_recipients FOR DELETE TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END;
$restore$;
