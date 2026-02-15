-- Migration 032: RPC for employee "my courses" listing with progress and status (single query, no N+1).
-- Used by CoursesEmployee; supports search, status filter, pagination.

CREATE OR REPLACE FUNCTION public.get_my_course_assignments_with_progress(
  p_user_id UUID,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  assignment_id UUID,
  course_id UUID,
  assigned_at TIMESTAMPTZ,
  course_title TEXT,
  course_description TEXT,
  course_type course_type,
  course_cover_url TEXT,
  course_tenant_id UUID,
  total_steps INT,
  completed_steps INT,
  quiz_passed BOOLEAN,
  status TEXT,
  progress_pct INT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_limit INT;
  v_offset INT;
BEGIN
  -- Only allow the authenticated user to read their own assignments
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN;
  END IF;

  v_limit := COALESCE(NULLIF(p_limit, 0), 100);
  v_offset := COALESCE(p_offset, 0);

  RETURN QUERY
  WITH base AS (
    SELECT
      a.id AS assignment_id,
      a.course_id,
      a.assigned_at,
      c.title AS course_title,
      c.description AS course_description,
      c.type AS course_type,
      c.cover_url AS course_cover_url,
      c.tenant_id AS course_tenant_id,
      (SELECT COUNT(*)::int FROM course_roadmap_items cri WHERE cri.course_id = c.id) AS total_steps,
      (SELECT COUNT(*)::int FROM course_roadmap_item_progress pr WHERE pr.assignment_id = a.id) AS completed_steps,
      EXISTS (SELECT 1 FROM course_questionnaire_attempts qa WHERE qa.assignment_id = a.id AND qa.passed = true) AS quiz_passed,
      CASE
        WHEN public.course_is_completed(a.id) THEN 'completed'::text
        WHEN EXISTS (SELECT 1 FROM course_roadmap_item_progress pr WHERE pr.assignment_id = a.id) THEN 'in_progress'::text
        ELSE 'not_started'::text
      END AS status
    FROM course_assignments a
    JOIN courses c ON c.id = a.course_id
    WHERE a.user_id = p_user_id
      AND c.tenant_id = public.get_my_profile_tenant_id()
      AND c.deleted_at IS NULL
      AND (
        p_search IS NULL
        OR trim(p_search) = ''
        OR c.title ILIKE '%' || trim(p_search) || '%'
        OR c.description ILIKE '%' || trim(p_search) || '%'
      )
  ),
  with_status AS (
    SELECT
      base.*,
      CASE
        WHEN base.total_steps > 0 THEN LEAST(100, ROUND(100.0 * base.completed_steps / base.total_steps)::int)
        ELSE (CASE WHEN base.quiz_passed THEN 100 ELSE 0 END)
      END AS progress_pct,
      COUNT(*) OVER() AS total_count
    FROM base
    WHERE (
      p_status IS NULL
      OR trim(p_status) = ''
      OR base.status = trim(p_status)
    )
  )
  SELECT
    with_status.assignment_id,
    with_status.course_id,
    with_status.assigned_at,
    with_status.course_title,
    with_status.course_description,
    with_status.course_type,
    with_status.course_cover_url,
    with_status.course_tenant_id,
    with_status.total_steps,
    with_status.completed_steps,
    with_status.quiz_passed,
    with_status.status,
    with_status.progress_pct,
    with_status.total_count
  FROM with_status
  ORDER BY (with_status.course_type = 'mandatory') DESC, with_status.assigned_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.get_my_course_assignments_with_progress IS 'Employee listing: assignments with progress (total_steps, completed_steps, progress_pct, status). Search and status filter in SQL.';
