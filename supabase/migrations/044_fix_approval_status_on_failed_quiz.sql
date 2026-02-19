-- Fix approval_status when user fails questionnaire: show Reprovado based on latest attempt,
-- not only when status = 'completed' (course_is_completed is true only when passed, so failed users stay in_progress).

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
  passing_score INT,
  approval_status TEXT,
  score_correct INT,
  score_total INT,
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
  WITH latest_attempt AS (
    SELECT DISTINCT ON (att.assignment_id)
      att.assignment_id,
      att.score,
      att.passed,
      att.correct_count,
      att.total_questions,
      att.questionnaire_id
    FROM course_questionnaire_attempts att
    ORDER BY att.assignment_id, att.submitted_at DESC
  ),
  base AS (
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
      cert.id AS certificate_id,
      (SELECT COALESCE(q.passing_score, 70) FROM course_questionnaires q WHERE q.course_id = c.id LIMIT 1) AS passing_score,
      la.passed AS latest_passed,
      la.score AS latest_score,
      la.questionnaire_id AS latest_questionnaire_id,
      la.correct_count AS latest_correct_count,
      la.total_questions AS latest_total_questions
    FROM course_assignments a
    JOIN courses c ON c.id = a.course_id
    JOIN profiles p ON p.id = a.user_id
    LEFT JOIN certificates cert ON cert.assignment_id = a.id
    LEFT JOIN latest_attempt la ON la.assignment_id = a.id
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
  with_approval AS (
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
      base.total_steps,
      base.completed_steps,
      base.certificate_id,
      base.passing_score,
      -- Approval from latest attempt: approved/failed whenever there is an attempt, regardless of course completion status.
      CASE
        WHEN base.latest_passed = true THEN 'approved'::text
        WHEN base.latest_passed = false THEN 'failed'::text
        ELSE NULL::text
      END AS approval_status,
      CASE
        WHEN base.latest_correct_count IS NOT NULL AND base.latest_total_questions IS NOT NULL THEN base.latest_correct_count
        WHEN base.latest_score IS NOT NULL AND base.latest_questionnaire_id IS NOT NULL THEN
          (SELECT ROUND((base.latest_score / 100.0) * COUNT(*))::int FROM questionnaire_questions qq WHERE qq.questionnaire_id = base.latest_questionnaire_id)
        ELSE NULL
      END AS score_correct,
      CASE
        WHEN base.latest_total_questions IS NOT NULL THEN base.latest_total_questions
        WHEN base.latest_questionnaire_id IS NOT NULL THEN
          (SELECT COUNT(*)::int FROM questionnaire_questions qq WHERE qq.questionnaire_id = base.latest_questionnaire_id)
        ELSE NULL
      END AS score_total,
      CASE
        WHEN base.total_steps > 0 THEN LEAST(100, ROUND(100.0 * base.completed_steps / base.total_steps)::int)
        ELSE (CASE WHEN base.status = 'completed' THEN 100 ELSE 0 END)
      END AS progress_pct
    FROM base
    WHERE (p_status IS NULL OR NULLIF(trim(p_status), '') IS NULL OR base.status = trim(p_status))
  ),
  with_count AS (
    SELECT
      with_approval.*,
      COUNT(*) OVER() AS total_count
    FROM with_approval
  )
  SELECT
    with_count.assignment_id,
    with_count.course_id,
    with_count.course_title,
    with_count.user_id,
    with_count.user_name,
    with_count.user_department,
    with_count.user_position,
    with_count.status,
    with_count.completed_at,
    with_count.progress_pct,
    with_count.total_steps,
    with_count.completed_steps,
    with_count.certificate_id,
    with_count.passing_score,
    with_count.approval_status,
    with_count.score_correct,
    with_count.score_total,
    with_count.total_count
  FROM with_count
  ORDER BY with_count.user_name, with_count.course_title
  LIMIT v_limit
  OFFSET v_offset;
END;
$body$;

COMMENT ON FUNCTION public.get_course_assignments_admin_progress(TEXT, TEXT, UUID, INT, INT) IS
  'HR/Manager: list assignments with progress, certificate_id, position, passing_score, approval_status (approved/failed from latest attempt), score_correct/score_total.';
