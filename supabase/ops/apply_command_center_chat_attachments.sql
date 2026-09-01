-- Command Center + sidecar chat file/image attachments (Staging apply)
INSERT INTO storage.buckets (id, name, public)
VALUES ('command-center-files', 'command-center-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users upload command center files" ON storage.objects;
CREATE POLICY "Authenticated users upload command center files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'command-center-files');

DROP POLICY IF EXISTS "Anyone read command center files" ON storage.objects;
CREATE POLICY "Anyone read command center files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'command-center-files');

DROP POLICY IF EXISTS "Users delete own command center files" ON storage.objects;
CREATE POLICY "Users delete own command center files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'command-center-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
