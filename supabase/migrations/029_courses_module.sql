-- Migration 029: Courses / Trainings module
-- Tables: courses, course_roadmap_items, course_assignments, course_roadmap_item_progress,
--         course_questionnaires, questionnaire_questions, course_questionnaire_attempts
-- RLS by role (HR/Manager manage; Employee sees own assignments and progress)

-- Enums
CREATE TYPE course_type AS ENUM ('mandatory', 'optional');
CREATE TYPE course_source AS ENUM ('imported_pdf', 'ai_created', 'manual');
CREATE TYPE roadmap_content_type AS ENUM ('video', 'pdf', 'audio', 'external_link');
CREATE TYPE questionnaire_question_type AS ENUM ('single_choice', 'multiple_choice');

-- Courses (tenant-scoped)
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type course_type NOT NULL DEFAULT 'optional',
  source course_source NOT NULL DEFAULT 'manual',
  cover_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_courses_tenant_id ON courses(tenant_id);
CREATE INDEX idx_courses_tenant_deleted ON courses(tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- courses: SELECT for tenant; INSERT/UPDATE/DELETE for HR/Manager
CREATE POLICY "Tenant can view courses" ON courses
  FOR SELECT
  USING (
    tenant_id = public.get_my_profile_tenant_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "HR and managers can insert courses" ON courses
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
    AND public.get_my_profile_role() IN ('hr', 'manager')
  );

CREATE POLICY "HR and managers can update courses" ON courses
  FOR UPDATE
  USING (
    tenant_id = public.get_my_profile_tenant_id()
    AND public.get_my_profile_role() IN ('hr', 'manager')
  );

CREATE POLICY "HR and managers can delete courses" ON courses
  FOR DELETE
  USING (
    tenant_id = public.get_my_profile_tenant_id()
    AND public.get_my_profile_role() IN ('hr', 'manager')
  );

-- Course roadmap items (ordered steps)
CREATE TABLE course_roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INT NOT NULL,
  content_type roadmap_content_type NOT NULL,
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_roadmap_items_course_id ON course_roadmap_items(course_id);

ALTER TABLE course_roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View roadmap items if can view course" ON course_roadmap_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_roadmap_items.course_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "HR and managers can manage roadmap items" ON course_roadmap_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_roadmap_items.course_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND public.get_my_profile_role() IN ('hr', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_roadmap_items.course_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND public.get_my_profile_role() IN ('hr', 'manager')
    )
  );

-- Course assignments (which user is assigned which course)
CREATE TABLE course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);

CREATE INDEX idx_course_assignments_course_id ON course_assignments(course_id);
CREATE INDEX idx_course_assignments_user_id ON course_assignments(user_id);

ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;

-- SELECT: assignee (own), HR (all tenant), Manager (team/department)
CREATE POLICY "Users can view own assignments" ON course_assignments
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "HR can view all tenant assignments" ON course_assignments
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_assignments.course_id AND c.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "Managers can view team assignments" ON course_assignments
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM courses c
      JOIN profiles p ON p.id = course_assignments.user_id
      WHERE c.id = course_assignments.course_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND (p.manager_id = auth.uid() OR (p.department IS NOT NULL AND p.department IS NOT DISTINCT FROM public.get_my_profile_department()))
    )
  );

CREATE POLICY "HR and managers can insert assignments" ON course_assignments
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() IN ('hr', 'manager')
    AND EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_assignments.course_id AND c.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "HR and managers can delete assignments" ON course_assignments
  FOR DELETE
  USING (
    public.get_my_profile_role() IN ('hr', 'manager')
    AND EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_assignments.course_id AND c.tenant_id = public.get_my_profile_tenant_id()
    )
  );

-- Roadmap item progress (per assignment, per step)
CREATE TABLE course_roadmap_item_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
  roadmap_item_id UUID NOT NULL REFERENCES course_roadmap_items(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, roadmap_item_id)
);

CREATE INDEX idx_course_roadmap_item_progress_assignment ON course_roadmap_item_progress(assignment_id);
CREATE INDEX idx_course_roadmap_item_progress_roadmap_item ON course_roadmap_item_progress(roadmap_item_id);

ALTER TABLE course_roadmap_item_progress ENABLE ROW LEVEL SECURITY;

-- SELECT: assignee (own), HR/Manager (tenant/team)
CREATE POLICY "Users can view own roadmap progress" ON course_roadmap_item_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_assignments a WHERE a.id = course_roadmap_item_progress.assignment_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "HR can view all tenant roadmap progress" ON course_roadmap_item_progress
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND EXISTS (
      SELECT 1 FROM course_assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = course_roadmap_item_progress.assignment_id AND c.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "Managers can view team roadmap progress" ON course_roadmap_item_progress
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM course_assignments a
      JOIN courses c ON c.id = a.course_id
      JOIN profiles p ON p.id = a.user_id
      WHERE a.id = course_roadmap_item_progress.assignment_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND (p.manager_id = auth.uid() OR (p.department IS NOT NULL AND p.department IS NOT DISTINCT FROM public.get_my_profile_department()))
    )
  );

-- INSERT/UPDATE: only assignee (own assignment)
CREATE POLICY "Users can insert own roadmap progress" ON course_roadmap_item_progress
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_assignments a WHERE a.id = course_roadmap_item_progress.assignment_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own roadmap progress" ON course_roadmap_item_progress
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM course_assignments a WHERE a.id = course_roadmap_item_progress.assignment_id AND a.user_id = auth.uid()
    )
  );

-- Course questionnaires (one per course, final quiz)
CREATE TABLE course_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score INT CHECK (passing_score IS NULL OR (passing_score >= 0 AND passing_score <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id)
);

CREATE INDEX idx_course_questionnaires_course_id ON course_questionnaires(course_id);

ALTER TABLE course_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View questionnaire if can view course" ON course_questionnaires
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_questionnaires.course_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "HR and managers can manage questionnaires" ON course_questionnaires
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_questionnaires.course_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND public.get_my_profile_role() IN ('hr', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_questionnaires.course_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND public.get_my_profile_role() IN ('hr', 'manager')
    )
  );

-- Questionnaire questions
CREATE TABLE questionnaire_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID NOT NULL REFERENCES course_questionnaires(id) ON DELETE CASCADE,
  position INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type questionnaire_question_type NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questionnaire_questions_questionnaire_id ON questionnaire_questions(questionnaire_id);

ALTER TABLE questionnaire_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View questions if can view questionnaire" ON questionnaire_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_questionnaires q
      JOIN courses c ON c.id = q.course_id
      WHERE q.id = questionnaire_questions.questionnaire_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "HR and managers can manage questions" ON questionnaire_questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM course_questionnaires q
      JOIN courses c ON c.id = q.course_id
      WHERE q.id = questionnaire_questions.questionnaire_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND public.get_my_profile_role() IN ('hr', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_questionnaires q
      JOIN courses c ON c.id = q.course_id
      WHERE q.id = questionnaire_questions.questionnaire_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND public.get_my_profile_role() IN ('hr', 'manager')
    )
  );

-- Questionnaire attempts (immutable per attempt)
CREATE TABLE course_questionnaire_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES course_questionnaires(id) ON DELETE CASCADE,
  score INT NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_questionnaire_attempts_assignment ON course_questionnaire_attempts(assignment_id);
CREATE INDEX idx_course_questionnaire_attempts_questionnaire ON course_questionnaire_attempts(questionnaire_id);

ALTER TABLE course_questionnaire_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts" ON course_questionnaire_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_assignments a WHERE a.id = course_questionnaire_attempts.assignment_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "HR can view all tenant attempts" ON course_questionnaire_attempts
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND EXISTS (
      SELECT 1 FROM course_assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = course_questionnaire_attempts.assignment_id AND c.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "Managers can view team attempts" ON course_questionnaire_attempts
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM course_assignments a
      JOIN courses c ON c.id = a.course_id
      JOIN profiles p ON p.id = a.user_id
      WHERE a.id = course_questionnaire_attempts.assignment_id
        AND c.tenant_id = public.get_my_profile_tenant_id()
        AND (p.manager_id = auth.uid() OR (p.department IS NOT NULL AND p.department IS NOT DISTINCT FROM public.get_my_profile_department()))
    )
  );

CREATE POLICY "Users can insert own attempts" ON course_questionnaire_attempts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_assignments a WHERE a.id = course_questionnaire_attempts.assignment_id AND a.user_id = auth.uid()
    )
  );

-- No UPDATE/DELETE on attempts (immutable)

-- Triggers: updated_at for courses, course_roadmap_items, course_questionnaires, questionnaire_questions
CREATE OR REPLACE FUNCTION public.set_courses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_courses_updated_at();

CREATE OR REPLACE FUNCTION public.set_course_roadmap_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER course_roadmap_items_updated_at
  BEFORE UPDATE ON course_roadmap_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_course_roadmap_items_updated_at();

CREATE OR REPLACE FUNCTION public.set_course_questionnaires_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER course_questionnaires_updated_at
  BEFORE UPDATE ON course_questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION public.set_course_questionnaires_updated_at();

CREATE OR REPLACE FUNCTION public.set_questionnaire_questions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER questionnaire_questions_updated_at
  BEFORE UPDATE ON questionnaire_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_questionnaire_questions_updated_at();

-- Soft delete: use UPDATE courses SET deleted_at = NOW() instead of DELETE
-- Policy for SELECT already filters deleted_at IS NULL

-- Grant
GRANT SELECT, INSERT, UPDATE, DELETE ON courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON course_roadmap_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON course_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON course_roadmap_item_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON course_questionnaires TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON questionnaire_questions TO authenticated;
GRANT SELECT, INSERT ON course_questionnaire_attempts TO authenticated;

-- Optional: course_is_completed(assignment_id) for reporting/UI
CREATE OR REPLACE FUNCTION public.course_is_completed(p_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_course_id UUID;
  v_roadmap_count INT;
  v_progress_count INT;
  v_has_passed_attempt BOOLEAN;
BEGIN
  SELECT course_id INTO v_course_id
  FROM course_assignments
  WHERE id = p_assignment_id
  LIMIT 1;

  IF v_course_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_roadmap_count
  FROM course_roadmap_items
  WHERE course_id = v_course_id;

  SELECT COUNT(*) INTO v_progress_count
  FROM course_roadmap_item_progress
  WHERE assignment_id = p_assignment_id;

  IF v_roadmap_count = 0 THEN
    -- No roadmap: completed only if questionnaire passed
    SELECT EXISTS (
      SELECT 1 FROM course_questionnaire_attempts
      WHERE assignment_id = p_assignment_id AND passed = true
    ) INTO v_has_passed_attempt;
    RETURN v_has_passed_attempt;
  END IF;

  IF v_progress_count < v_roadmap_count THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM course_questionnaire_attempts
    WHERE assignment_id = p_assignment_id AND passed = true
  ) INTO v_has_passed_attempt;

  RETURN v_has_passed_attempt;
END;
$$;

-- Admin list: one row per (assignment) for HR/Manager with status
CREATE OR REPLACE FUNCTION public.get_course_assignments_admin_list(
  p_course_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  assignment_id uuid,
  course_id uuid,
  course_title text,
  user_id uuid,
  user_name text,
  user_department text,
  status text,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  my_tenant_id UUID;
  my_role TEXT;
  my_department TEXT;
BEGIN
  SELECT p.tenant_id, p.role::text, p.department
  INTO my_tenant_id, my_role, my_department
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF my_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    c.id,
    c.title,
    p.id,
    p.name,
    p.department,
    CASE
      WHEN public.course_is_completed(a.id) THEN 'completed'::text
      WHEN EXISTS (SELECT 1 FROM course_roadmap_item_progress pr WHERE pr.assignment_id = a.id) THEN 'in_progress'::text
      ELSE 'not_started'::text
    END,
    (SELECT MAX(att.submitted_at) FROM course_questionnaire_attempts att WHERE att.assignment_id = a.id AND att.passed = true)
  FROM course_assignments a
  JOIN courses c ON c.id = a.course_id
  JOIN profiles p ON p.id = a.user_id
  WHERE c.tenant_id = my_tenant_id
    AND c.deleted_at IS NULL
    AND (p_course_id IS NULL OR a.course_id = p_course_id)
    AND (p_user_id IS NULL OR a.user_id = p_user_id)
    AND (
      my_role = 'hr'
      OR (my_role = 'manager' AND (p.manager_id = auth.uid() OR (p.department IS NOT NULL AND p.department IS NOT DISTINCT FROM my_department)))
      OR (my_role = 'employee' AND p.id = auth.uid())
    );
END;
$$;

COMMENT ON TABLE courses IS 'Courses/Trainings; soft delete via deleted_at';
COMMENT ON TABLE course_roadmap_items IS 'Ordered learning steps (video, pdf, etc.)';
COMMENT ON TABLE course_assignments IS 'Which user is assigned which course';
COMMENT ON TABLE course_roadmap_item_progress IS 'Per-assignment, per-step completion';
COMMENT ON TABLE course_questionnaires IS 'Final quiz per course';
COMMENT ON TABLE questionnaire_questions IS 'Questions and correct answers';
COMMENT ON TABLE course_questionnaire_attempts IS 'Immutable attempt per assignment';
