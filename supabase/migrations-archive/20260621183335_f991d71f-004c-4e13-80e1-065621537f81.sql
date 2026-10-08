
CREATE POLICY "carmen_media_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'carmen-media'
    AND (storage.foldername(name))[1] = public.get_effective_tenant_id()::text
  );

CREATE POLICY "carmen_media_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'carmen-media'
    AND (storage.foldername(name))[1] = public.get_effective_tenant_id()::text
  );

CREATE POLICY "carmen_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'carmen-media'
    AND (storage.foldername(name))[1] = public.get_effective_tenant_id()::text
  );

CREATE POLICY "carmen_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'carmen-media'
    AND (storage.foldername(name))[1] = public.get_effective_tenant_id()::text
  );
