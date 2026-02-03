-- Migration 012: Storage bucket for tenant branding assets (logo, login cover)
-- Path format: {tenant_id}/logo.ext or {tenant_id}/login-cover.ext

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets',
  'tenant-assets',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read: anyone can view files (for login screen and emails)
CREATE POLICY "Public read tenant-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tenant-assets');

-- HR can upload/update only to their tenant folder
CREATE POLICY "HR can upload to own tenant folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND public.get_my_profile_role() = 'hr'
);

CREATE POLICY "HR can update own tenant folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND public.get_my_profile_role() = 'hr'
);

CREATE POLICY "HR can delete own tenant folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND public.get_my_profile_role() = 'hr'
);
