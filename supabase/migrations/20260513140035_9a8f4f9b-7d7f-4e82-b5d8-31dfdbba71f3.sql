
-- Create task-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: authenticated users in the tenant folder can manage their files
CREATE POLICY "Tenant members can view task attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant members can upload task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant members can update task attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Tenant members can delete task attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);
