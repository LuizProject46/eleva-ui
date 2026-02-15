-- Migration 031: Allow image MIME types in course-content bucket for course cover/thumbnails
-- Path for covers: {tenant_id}/courses/{course_id}/cover.{ext}

UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
WHERE id = 'course-content';
