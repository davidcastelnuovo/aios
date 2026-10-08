-- Ensure signature-documents storage bucket exists (Staging may have missed initial migration)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signature-documents', 'signature-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload signature docs'
  ) THEN
    CREATE POLICY "Authenticated users can upload signature docs"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'signature-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can view signature docs'
  ) THEN
    CREATE POLICY "Authenticated users can view signature docs"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'signature-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Anon can view signature docs for signing'
  ) THEN
    CREATE POLICY "Anon can view signature docs for signing"
      ON storage.objects FOR SELECT TO anon
      USING (bucket_id = 'signature-documents');
  END IF;
END $$;
