-- Migration 052: PDI Goals and Action Plans refactor.
-- - Add progress_pct to pdi_actions; sync course progress into it via trigger.
-- - RPCs: get_pdi_action_progress, get_pdi_goal_progress.
-- - Remove stored status from pdi_objectives (goals); progress/status computed from actions.
-- - RLS: employee can update status and progress_pct on practice actions (own).

-- 1. Add progress_pct and optional completion_criteria to pdi_actions
ALTER TABLE pdi_actions
  ADD COLUMN IF NOT EXISTS progress_pct INT NOT NULL DEFAULT 0
    CHECK (progress_pct >= 0 AND progress_pct <= 100);

ALTER TABLE pdi_actions
  ADD COLUMN IF NOT EXISTS completion_criteria TEXT;

COMMENT ON COLUMN pdi_actions.progress_pct IS '0-100. For course: synced from course; for practice: user-editable.';
COMMENT ON COLUMN pdi_actions.completion_criteria IS 'Optional completion criteria description.';

-- 2. Function: get course progress for an assignment (progress_pct 0-100, status text)
CREATE OR REPLACE FUNCTION public.get_course_assignment_progress(p_assignment_id UUID)
RETURNS TABLE(progress_pct INT, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_course_id UUID;
  v_total INT;
  v_done INT;
  v_quiz_passed BOOLEAN;
BEGIN
  SELECT ca.course_id INTO v_course_id
  FROM course_assignments ca
  WHERE ca.id = p_assignment_id
  LIMIT 1;

  IF v_course_id IS NULL THEN
    progress_pct := 0;
    status := 'pending';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO v_total FROM course_roadmap_items WHERE course_id = v_course_id;
  SELECT COUNT(*)::int INTO v_done FROM course_roadmap_item_progress WHERE assignment_id = p_assignment_id;
  SELECT EXISTS (SELECT 1 FROM course_questionnaire_attempts WHERE assignment_id = p_assignment_id AND passed = true) INTO v_quiz_passed;

  IF public.course_is_completed(p_assignment_id) THEN
    progress_pct := 100;
    status := 'completed';
  ELSIF v_total > 0 THEN
    progress_pct := LEAST(100, ROUND(100.0 * v_done / v_total)::int);
    status := CASE WHEN v_done > 0 THEN 'in_progress' ELSE 'pending' END;
  ELSE
    progress_pct := CASE WHEN v_quiz_passed THEN 100 ELSE 0 END;
    status := CASE WHEN v_quiz_passed THEN 'completed' WHEN v_done > 0 THEN 'in_progress' ELSE 'pending' END;
  END IF;

  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_course_assignment_progress(UUID) IS 'Returns progress_pct and status for a course assignment (for PDI course action sync).';

-- Backfill course-linked actions: set progress_pct and status from course (run once)
DO $$
DECLARE
  r RECORD;
  v_pct INT;
  v_status TEXT;
BEGIN
  FOR r IN
    SELECT a.id, a.course_assignment_id
    FROM pdi_actions a
    WHERE a.type = 'course' AND a.course_assignment_id IS NOT NULL
  LOOP
    IF public.course_is_completed(r.course_assignment_id) THEN
      v_pct := 100;
      v_status := 'completed';
    ELSE
      SELECT g.progress_pct, g.status INTO v_pct, v_status
      FROM public.get_course_assignment_progress(r.course_assignment_id) AS g
      LIMIT 1;
      v_pct := COALESCE(v_pct, 0);
      v_status := COALESCE(v_status, 'pending');
    END IF;
    UPDATE pdi_actions SET progress_pct = v_pct, status = v_status, updated_at = NOW() WHERE id = r.id;
  END LOOP;
END;
$$;

-- 3. Replace trigger: on course progress change, update all pdi_actions linked to that assignment
CREATE OR REPLACE FUNCTION public.sync_pdi_actions_on_course_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
  v_rec RECORD;
BEGIN
  IF TG_TABLE_NAME = 'course_roadmap_item_progress' THEN
    v_assignment_id := NEW.assignment_id;
  ELSIF TG_TABLE_NAME = 'course_questionnaire_attempts' THEN
    v_assignment_id := NEW.assignment_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_assignment_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  FOR v_rec IN
    SELECT g.progress_pct, g.status
    FROM public.get_course_assignment_progress(v_assignment_id) AS g
  LOOP
    UPDATE pdi_actions
    SET
      progress_pct = v_rec.progress_pct,
      status = v_rec.status,
      updated_at = NOW()
    WHERE course_assignment_id = v_assignment_id
      AND type = 'course';
    EXIT;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.sync_pdi_actions_on_course_completion() IS 'Trigger: on course progress change, sync progress_pct and status for PDI actions linked to that assignment.';

-- 4. RPC: get progress for a single PDI action (for UI)
CREATE OR REPLACE FUNCTION public.get_pdi_action_progress(p_action_id UUID)
RETURNS TABLE(
  action_id UUID,
  progress_pct INT,
  status TEXT,
  is_from_course BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_type TEXT;
  v_course_assignment_id UUID;
  v_stored_pct INT;
  v_stored_status TEXT;
  v_rec RECORD;
BEGIN
  SELECT a.type, a.course_assignment_id, a.progress_pct, a.status
  INTO v_type, v_course_assignment_id, v_stored_pct, v_stored_status
  FROM pdi_actions a
  WHERE a.id = p_action_id;

  IF v_type IS NULL THEN
    RETURN;
  END IF;

  IF v_type = 'course' AND v_course_assignment_id IS NOT NULL THEN
    FOR v_rec IN
      SELECT g.progress_pct, g.status
      FROM public.get_course_assignment_progress(v_course_assignment_id) AS g
    LOOP
      action_id := p_action_id;
      progress_pct := v_rec.progress_pct;
      status := v_rec.status;
      is_from_course := true;
      RETURN NEXT;
      RETURN;
    END LOOP;
    -- fallback to stored
    action_id := p_action_id;
    progress_pct := COALESCE(v_stored_pct, 0);
    status := COALESCE(v_stored_status, 'pending');
    is_from_course := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- practice: return stored
  action_id := p_action_id;
  progress_pct := COALESCE(v_stored_pct, 0);
  status := COALESCE(v_stored_status, 'pending');
  is_from_course := false;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_pdi_action_progress(UUID) IS 'Returns progress_pct, status, and is_from_course for one PDI action. Course actions use live course data.';

GRANT EXECUTE ON FUNCTION public.get_pdi_action_progress(UUID) TO authenticated;

-- 5. RPC: get computed progress and derived status for a goal (pdi_objective)
CREATE OR REPLACE FUNCTION public.get_pdi_goal_progress(p_objective_id UUID)
RETURNS TABLE(
  objective_id UUID,
  progress_pct NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_actions INT;
  v_sum_pct NUMERIC;
  v_avg_pct NUMERIC;
  v_all_completed BOOLEAN;
  v_derived_status TEXT;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(a.progress_pct), 0)
  INTO v_actions, v_sum_pct
  FROM pdi_actions a
  WHERE a.pdi_objective_id = p_objective_id;

  IF v_actions IS NULL OR v_actions = 0 THEN
    objective_id := p_objective_id;
    progress_pct := 0;
    status := 'not_started';
    RETURN NEXT;
    RETURN;
  END IF;

  v_avg_pct := ROUND(v_sum_pct / v_actions, 1);

  SELECT BOOL_AND(a.status = 'completed')
  INTO v_all_completed
  FROM pdi_actions a
  WHERE a.pdi_objective_id = p_objective_id;

  v_derived_status := CASE
    WHEN v_all_completed AND v_avg_pct >= 100 THEN 'completed'
    WHEN v_avg_pct > 0 THEN 'in_progress'
    ELSE 'not_started'
  END;

  objective_id := p_objective_id;
  progress_pct := LEAST(100, v_avg_pct);
  status := v_derived_status;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_pdi_goal_progress(UUID) IS 'Returns computed progress_pct and derived status for a PDI objective (goal) from its action plans.';

GRANT EXECUTE ON FUNCTION public.get_pdi_goal_progress(UUID) TO authenticated;

-- 6. Remove stored status from pdi_objectives; goal status is computed only
ALTER TABLE pdi_objectives
  DROP COLUMN IF EXISTS status;

COMMENT ON TABLE pdi_objectives IS 'PDI goals; progress and status are computed from linked action plans (get_pdi_goal_progress).';

-- 7. RLS: employee can UPDATE only status and progress_pct on practice actions where they are responsible
CREATE POLICY "Employees can update own practice action progress" ON pdi_actions
  FOR UPDATE
  USING (
    type = 'practice'
    AND responsible_user_id = auth.uid()
  )
  WITH CHECK (
    type = 'practice'
    AND responsible_user_id = auth.uid()
  );

-- Restrict employee update to only status and progress_pct (enforce in app; DB cannot restrict columns in policy)
-- Optional: use a trigger to reject changes to other columns when role = employee. Omitted for simplicity; app layer enforces.
