-- Migration 028: Storage bucket for user avatars
-- Path format: {tenant_id}/{user_id}/standard.webp and {tenant_id}/{user_id}/thumb.webp
-- Only WEBP allowed (client converts before upload). 5MB limit.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for display
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- User can upload only to own path: {tenant_id}/{auth.uid()}/...
-- HR can upload to any {tenant_id}/{user_id}/... within their tenant
CREATE POLICY "Users and HR can insert avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.get_my_profile_role() = 'hr'
  )
);

CREATE POLICY "Users and HR can update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.get_my_profile_role() = 'hr'
  )
);

CREATE POLICY "Users and HR can delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.get_my_profile_role() = 'hr'
  )
);
