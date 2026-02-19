-- Add user_position (Cargo) to admin progress RPC for Progresso dos Colaboradores grid.
DROP FUNCTION IF EXISTS public.get_course_assignments_admin_progress(TEXT, TEXT, UUID, INT, INT);

CREATE FUNCTION public.get_course_assignments_admin_progress(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_course_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  assignment_id UUID,
  course_id UUID,
  course_title TEXT,
  user_id UUID,
  user_name TEXT,
  user_department TEXT,
  user_position TEXT,
  status TEXT,
  completed_at TIMESTAMPTZ,
  progress_pct INT,
  total_steps INT,
  completed_steps INT,
  certificate_id UUID,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $body$
DECLARE
  my_tenant_id UUID;
  my_role TEXT;
  my_department TEXT;
  v_limit INT;
  v_offset INT;
  v_search TEXT;
BEGIN
  SELECT p.tenant_id, p.role::text, p.department
  INTO my_tenant_id, my_role, my_department
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF my_tenant_id IS NULL THEN
    RETURN;
  END IF;

  v_limit := COALESCE(NULLIF(p_limit, 0), 20);
  v_offset := COALESCE(p_offset, 0);
  v_search := NULLIF(trim(p_search), '');

  RETURN QUERY
  WITH base AS (
    SELECT
      a.id AS assignment_id,
      a.course_id,
      c.title AS course_title,
      p.id AS user_id,
      p.name AS user_name,
      p.department AS user_department,
      p.position AS user_position,
      CASE
        WHEN public.course_is_completed(a.id) THEN 'completed'::text
        WHEN EXISTS (SELECT 1 FROM course_roadmap_item_progress pr WHERE pr.assignment_id = a.id) THEN 'in_progress'::text
        ELSE 'not_started'::text
      END AS status,
      (SELECT MAX(att.submitted_at) FROM course_questionnaire_attempts att WHERE att.assignment_id = a.id AND att.passed = true) AS completed_at,
      (SELECT COUNT(*)::int FROM course_roadmap_items cri WHERE cri.course_id = c.id) AS total_steps,
      (SELECT COUNT(*)::int FROM course_roadmap_item_progress pr WHERE pr.assignment_id = a.id) AS completed_steps,
      cert.id AS certificate_id
    FROM course_assignments a
    JOIN courses c ON c.id = a.course_id
    JOIN profiles p ON p.id = a.user_id
    LEFT JOIN certificates cert ON cert.assignment_id = a.id
    WHERE c.tenant_id = my_tenant_id
      AND c.deleted_at IS NULL
      AND (p_course_id IS NULL OR a.course_id = p_course_id)
      AND (
        my_role = 'hr'
        OR (my_role = 'manager' AND (p.manager_id = auth.uid()))
        OR (my_role = 'employee' AND p.id = auth.uid())
      )
      AND (v_search IS NULL OR p.name ILIKE '%' || v_search || '%' OR c.title ILIKE '%' || v_search || '%')
  ),
  with_pct AS (
    SELECT
      base.assignment_id,
      base.course_id,
      base.course_title,
      base.user_id,
      base.user_name,
      base.user_department,
      base.user_position,
      base.status,
      base.completed_at,
      CASE
        WHEN base.total_steps > 0 THEN LEAST(100, ROUND(100.0 * base.completed_steps / base.total_steps)::int)
        ELSE (CASE WHEN base.status = 'completed' THEN 100 ELSE 0 END)
      END AS progress_pct,
      base.total_steps,
      base.completed_steps,
      base.certificate_id,
      COUNT(*) OVER() AS total_count
    FROM base
    WHERE (p_status IS NULL OR NULLIF(trim(p_status), '') IS NULL OR base.status = trim(p_status))
  )
  SELECT
    with_pct.assignment_id,
    with_pct.course_id,
    with_pct.course_title,
    with_pct.user_id,
    with_pct.user_name,
    with_pct.user_department,
    with_pct.user_position,
    with_pct.status,
    with_pct.completed_at,
    with_pct.progress_pct,
    with_pct.total_steps,
    with_pct.completed_steps,
    with_pct.certificate_id,
    with_pct.total_count
  FROM with_pct
  ORDER BY with_pct.user_name, with_pct.course_title
  LIMIT v_limit
  OFFSET v_offset;
END;
$body$;

COMMENT ON FUNCTION public.get_course_assignments_admin_progress(TEXT, TEXT, UUID, INT, INT) IS 'HR/Manager: list assignments with progress, certificate_id and user position (Cargo). Search (name/course), status and course filters, pagination.';
