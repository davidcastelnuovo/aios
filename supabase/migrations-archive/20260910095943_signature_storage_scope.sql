-- Deploy get-signature-document and the token-based signer UI BEFORE this policy
-- change. External signers receive a signed URL for their document from that endpoint.
DROP POLICY IF EXISTS "Anon can view signature docs for signing" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view signature docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload signature docs" ON storage.objects;
CREATE POLICY "Authenticated users can view signature docs" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'signature-documents'
  AND ((storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text OR public.is_super_admin(auth.uid()))
);
CREATE POLICY "Authenticated users can upload signature docs" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'signature-documents'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
);
