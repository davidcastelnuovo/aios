
-- ============================================================
-- SECURITY HARDENING — Phase 2: Storage privatization
-- ============================================================

-- Make sensitive storage buckets private
UPDATE storage.buckets
SET public = false
WHERE id IN ('recordings','team-chat-files','team-attachments','supplier-invoices');

-- Drop public/anon SELECT policies and replace with authenticated-only
DROP POLICY IF EXISTS "Anyone can read team chat files" ON storage.objects;
CREATE POLICY "Authenticated users can read team chat files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'team-chat-files');

DROP POLICY IF EXISTS "Anyone can view team attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view team attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'team-attachments');

DROP POLICY IF EXISTS "Anyone can view supplier invoices" ON storage.objects;
CREATE POLICY "Authenticated users can view supplier invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-invoices');

-- recordings already has an authenticated SELECT policy; ensure no public one exists
DROP POLICY IF EXISTS "Anyone can view recordings" ON storage.objects;
DROP POLICY IF EXISTS "Public can view recordings" ON storage.objects;
