-- Migration 035: Secure questionnaire attempt – questions without correct_answer, score computed in backend only.
-- Frontend never receives correct answers; validation happens server-side.

-- Returns questionnaire questions for taking the test (no correct_answer).
-- Caller must have an assignment for this questionnaire's course (enforced inside).
CREATE OR REPLACE FUNCTION public.get_questionnaire_questions_for_attempt(p_questionnaire_id UUID)
RETURNS TABLE (
  id UUID,
  question_position INT,
  question_text TEXT,
  question_type questionnaire_question_type,
  options JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  -- Ensure questionnaire exists and get course_id
  SELECT q.course_id INTO v_course_id
  FROM course_questionnaires q
  WHERE q.id = p_questionnaire_id
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RETURN;
  END IF;

  -- Only allow if the current user has an assignment for this course (they are taking the test)
  IF NOT EXISTS (
    SELECT 1 FROM course_assignments a
    WHERE a.course_id = v_course_id AND a.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    qq.id,
    qq.position as question_position,
    qq.question_text as question_text,
    qq.question_type as question_type,
    qq.options as question_options
  FROM questionnaire_questions qq
  WHERE qq.questionnaire_id = p_questionnaire_id
  ORDER BY qq.position ASC;
END;
$$;

COMMENT ON FUNCTION public.get_questionnaire_questions_for_attempt(UUID) IS
  'Returns questions for test-taking without correct_answer. Only callable if user has an assignment for the questionnaire course.';

-- Submits an attempt: validates assignment ownership, computes score server-side, inserts attempt, returns result.
-- p_answers: JSONB e.g. { "question-uuid-1": "Option A", "question-uuid-2": ["Option B", "Option C"] }
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
  -- Assignment must belong to current user
  SELECT a.user_id, a.course_id INTO v_user_id, v_course_id
  FROM course_assignments a
  WHERE a.id = p_assignment_id
  LIMIT 1;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Assignment not found or access denied';
  END IF;

  -- Questionnaire must belong to same course
  SELECT q.course_id INTO v_questionnaire_course_id
  FROM course_questionnaires q
  WHERE q.id = p_questionnaire_id
  LIMIT 1;

  IF v_questionnaire_course_id IS NULL OR v_questionnaire_course_id != v_course_id THEN
    RAISE EXCEPTION 'Questionnaire not found or does not match assignment';
  END IF;

  -- Get passing score (default 70)
  SELECT COALESCE(q.passing_score, 70) INTO v_passing_score
  FROM course_questionnaires q
  WHERE q.id = p_questionnaire_id;

  -- Compute score from questions (with correct_answer) and p_answers
  FOR v_questions IN
    SELECT qq.id, qq.question_type, qq.options, qq.correct_answer
    FROM questionnaire_questions qq
    WHERE qq.questionnaire_id = p_questionnaire_id
    ORDER BY qq.position
  LOOP
    v_total := v_total + 1;
    v_user_answer := p_answers->v_questions.id::text;

    IF v_user_answer IS NULL OR v_user_answer = 'null'::JSONB THEN
      -- Unanswered
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
      -- Compare sets (order-independent)
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

  INSERT INTO course_questionnaire_attempts (assignment_id, questionnaire_id, score, passed, answers)
  VALUES (p_assignment_id, p_questionnaire_id, v_score, v_passed, p_answers);

  RETURN jsonb_build_object('score', v_score, 'passed', v_passed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_questionnaire_questions_for_attempt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_questionnaire_attempt(UUID, UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.submit_questionnaire_attempt(UUID, UUID, JSONB) IS
  'Validates assignment ownership, computes score server-side from stored correct_answer, inserts attempt. Frontend never sees correct answers.';
