-- Signatures were scoped only to get_user_tenant_id (user_active_tenant).
-- Multi-org owners switching via /t/<slug>/ could not upload or send while the
-- active-tenant row lagged behind the URL tenant. Align with tenant_users membership.

DROP POLICY IF EXISTS "Users can view documents in their tenant" ON public.signature_documents;
CREATE POLICY "Users can view documents in their tenant"
  ON public.signature_documents FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can create documents in their tenant" ON public.signature_documents;
CREATE POLICY "Users can create documents in their tenant"
  ON public.signature_documents FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update documents in their tenant" ON public.signature_documents;
CREATE POLICY "Users can update documents in their tenant"
  ON public.signature_documents FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete documents in their tenant" ON public.signature_documents;
CREATE POLICY "Users can delete documents in their tenant"
  ON public.signature_documents FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view recipients in their tenant" ON public.signature_recipients;
CREATE POLICY "Users can view recipients in their tenant"
  ON public.signature_recipients FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage recipients in their tenant" ON public.signature_recipients;
CREATE POLICY "Users can manage recipients in their tenant"
  ON public.signature_recipients FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update recipients in their tenant" ON public.signature_recipients;
CREATE POLICY "Users can update recipients in their tenant"
  ON public.signature_recipients FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete recipients in their tenant" ON public.signature_recipients;
CREATE POLICY "Users can delete recipients in their tenant"
  ON public.signature_recipients FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can view signature docs" ON storage.objects;
CREATE POLICY "Authenticated users can view signature docs" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'signature-documents'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT tenant_id::text FROM public.tenant_users WHERE user_id = auth.uid()
      )
      OR public.is_super_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload signature docs" ON storage.objects;
CREATE POLICY "Authenticated users can upload signature docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'signature-documents'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT tenant_id::text FROM public.tenant_users WHERE user_id = auth.uid()
      )
      OR public.is_super_admin(auth.uid())
    )
  );
