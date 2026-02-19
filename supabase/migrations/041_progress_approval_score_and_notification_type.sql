-- Migration 041: Employee progress approval/score columns and mandatory_course_assigned notification type.
-- 1. Extend notifications.type for mandatory course notifications.
-- 2. Add correct_count and total_questions to course_questionnaire_attempts (exact score display).
-- 3. Update submit_questionnaire_attempt to set them.
-- 4. Extend get_course_assignments_admin_progress with passing_score, approval_status, score_correct, score_total.

-- 1. Notifications: allow mandatory_course_assigned (in-app notification when assigned to mandatory course).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'evaluation_received',
    'feedback_received',
    'evaluation_period_reminder',
    'assessment_period_reminder',
    'mandatory_course_assigned'
  )
);

-- 2. Attempts: store exact correct/total for grid display (optional for existing rows).
ALTER TABLE course_questionnaire_attempts
  ADD COLUMN IF NOT EXISTS correct_count INT,
  ADD COLUMN IF NOT EXISTS total_questions INT;

COMMENT ON COLUMN course_questionnaire_attempts.correct_count IS 'Number of correct answers; set by submit_questionnaire_attempt.';
COMMENT ON COLUMN course_questionnaire_attempts.total_questions IS 'Total questions in the questionnaire at attempt time; set by submit_questionnaire_attempt.';

-- 3. submit_questionnaire_attempt: set correct_count and total_questions on INSERT.
CREATE OR REPLACE FUNCTION public.submit_questionnaire_attempt(
  p_assignment_id UUID,
  p_questionnaire_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_course_id UUID;
  v_questionnaire_course_id UUID;
  v_passing_score INT;
  v_questions RECORD;
  v_user_answer JSONB;
  v_correct_answer JSONB;
  v_correct_count INT := 0;
  v_total INT := 0;
  v_score INT;
  v_passed BOOLEAN;
  v_expected_set TEXT[];
  v_user_set TEXT[];
BEGIN
  SELECT a.user_id, a.course_id INTO v_user_id, v_course_id
  FROM course_assignments a
  WHERE a.id = p_assignment_id
  LIMIT 1;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Assignment not found or access denied';
  END IF;

  SELECT q.course_id INTO v_questionnaire_course_id
  FROM course_questionnaires q
  WHERE q.id = p_questionnaire_id
  LIMIT 1;

  IF v_questionnaire_course_id IS NULL OR v_questionnaire_course_id != v_course_id THEN
    RAISE EXCEPTION 'Questionnaire not found or does not match assignment';
  END IF;

  SELECT COALESCE(q.passing_score, 70) INTO v_passing_score
  FROM course_questionnaires q
  WHERE q.id = p_questionnaire_id;

  FOR v_questions IN
    SELECT qq.id, qq.question_type, qq.options, qq.correct_answer
    FROM questionnaire_questions qq
    WHERE qq.questionnaire_id = p_questionnaire_id
    ORDER BY qq.position
  LOOP
    v_total := v_total + 1;
    v_user_answer := p_answers->v_questions.id::text;

    IF v_user_answer IS NULL OR v_user_answer = 'null'::JSONB THEN
      CONTINUE;
    END IF;

    v_correct_answer := v_questions.correct_answer;

    IF v_questions.question_type = 'single_choice' THEN
      IF jsonb_typeof(v_correct_answer) = 'array' THEN
        v_correct_answer := v_correct_answer->0;
      END IF;
      IF jsonb_typeof(v_user_answer) = 'array' THEN
        v_user_answer := v_user_answer->0;
      END IF;
      IF v_user_answer IS NOT NULL AND v_correct_answer IS NOT NULL
         AND trim(both '"' from v_user_answer::text) = trim(both '"' from v_correct_answer::text) THEN
        v_correct_count := v_correct_count + 1;
      END IF;
    ELSIF v_questions.question_type = 'multiple_choice' THEN
      v_expected_set := ARRAY(
        SELECT trim(both '"' from elem::text)
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(v_correct_answer) = 'array' THEN v_correct_answer ELSE jsonb_build_array(v_correct_answer) END
        ) AS elem
      );
      v_user_set := ARRAY(
        SELECT trim(both '"' from elem::text)
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(v_user_answer) = 'array' THEN v_user_answer ELSE jsonb_build_array(v_user_answer) END
        ) AS elem
      );
      IF v_expected_set @> v_user_set AND v_user_set @> v_expected_set THEN
        v_correct_count := v_correct_count + 1;
      END IF;
    END IF;
  END LOOP;

  v_score := CASE WHEN v_total > 0 THEN round((v_correct_count::numeric / v_total) * 100)::INT ELSE 0 END;
  v_passed := v_score >= v_passing_score;

  INSERT INTO course_questionnaire_attempts (assignment_id, questionnaire_id, score, passed, answers, correct_count, total_questions)
  VALUES (p_assignment_id, p_questionnaire_id, v_score, v_passed, p_answers, v_correct_count, v_total);

  RETURN jsonb_build_object('score', v_score, 'passed', v_passed);
END;
$$;

COMMENT ON FUNCTION public.submit_questionnaire_attempt(UUID, UUID, JSONB) IS
  'Validates assignment ownership, computes score server-side, inserts attempt with correct_count/total_questions. Frontend never sees correct answers.';

-- 4. Admin progress RPC: add passing_score, approval_status, score_correct, score_total.
-- Approval: approved when completed and latest attempt passed; failed when completed and not passed; null when not completed.
-- Score: from latest attempt (use correct_count/total_questions when set, else derive from score and question count).
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
      CASE
        WHEN base.status != 'completed' THEN NULL::text
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
  'HR/Manager: list assignments with progress, certificate_id, position, passing_score, approval_status (approved/failed), score_correct/score_total. Search (name/course), status and course filters, pagination.';
