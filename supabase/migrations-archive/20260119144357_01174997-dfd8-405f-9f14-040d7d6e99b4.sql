-- 1) Private bucket for lead/client attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('entity-attachments', 'entity-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Storage RLS policies (tenant-folder isolation)
-- Object path convention: {tenant_id}/{entity}/{entity_id}/{file}
-- Enforce that the first folder segment equals the user's tenant id

DROP POLICY IF EXISTS "Users can upload attachments to their tenant folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments from their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete attachments from their tenant" ON storage.objects;

CREATE POLICY "Users can upload attachments to their tenant folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'entity-attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
);

CREATE POLICY "Users can view attachments from their tenant"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'entity-attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
);

CREATE POLICY "Users can delete attachments from their tenant"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'entity-attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
);

-- 3) Metadata columns on entities
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4) Multiple folder links for leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS folder_links jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.leads
SET folder_links = jsonb_build_array(
  jsonb_build_object('name', 'קישור', 'url', folder_link)
)
WHERE folder_link IS NOT NULL
  AND folder_link <> ''
  AND (folder_links IS NULL OR folder_links = '[]'::jsonb);
