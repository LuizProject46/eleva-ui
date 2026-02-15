-- Migration 030: Storage bucket for course content (PDFs, videos)
-- Path format: {tenant_id}/courses/{course_id}/roadmap/{roadmap_item_id}/{filename}
--             or {tenant_id}/courses/{course_id}/videos/{session_or_item_id}/{filename}
-- Private bucket; authenticated tenant members can read; HR/Manager can write.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-content',
  'course-content',
  false,
  104857600,
  ARRAY['application/pdf', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- SELECT: authenticated users can read if path starts with their tenant_id
CREATE POLICY "Tenant can read course content"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-content'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
);

-- INSERT/UPDATE/DELETE: HR and Manager only, under their tenant folder
CREATE POLICY "HR and managers can insert course content"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-content'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND public.get_my_profile_role() IN ('hr', 'manager')
);

CREATE POLICY "HR and managers can update course content"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-content'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND public.get_my_profile_role() IN ('hr', 'manager')
);

CREATE POLICY "HR and managers can delete course content"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-content'
  AND (storage.foldername(name))[1] = public.get_my_profile_tenant_id()::text
  AND public.get_my_profile_role() IN ('hr', 'manager')
);
