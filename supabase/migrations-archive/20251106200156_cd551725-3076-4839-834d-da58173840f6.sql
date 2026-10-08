-- Create storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true);

-- RLS policies for tenant-logos bucket
CREATE POLICY "Tenant members can view their tenant logo"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'tenant-logos' AND
  (
    is_super_admin(auth.uid()) OR
    (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
  )
);

CREATE POLICY "Owners can upload tenant logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-logos' AND
  (
    is_super_admin(auth.uid()) OR
    (
      has_role(auth.uid(), 'owner') AND
      (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    )
  )
);

CREATE POLICY "Owners can update tenant logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-logos' AND
  (
    is_super_admin(auth.uid()) OR
    (
      has_role(auth.uid(), 'owner') AND
      (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    )
  )
);

CREATE POLICY "Owners can delete tenant logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-logos' AND
  (
    is_super_admin(auth.uid()) OR
    (
      has_role(auth.uid(), 'owner') AND
      (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    )
  )
);