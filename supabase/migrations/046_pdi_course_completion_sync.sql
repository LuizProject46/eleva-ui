-- Migration 046: When a course assignment is completed, mark linked PDI actions as completed.
-- Trigger on course_roadmap_item_progress and course_questionnaire_attempts.

CREATE OR REPLACE FUNCTION public.sync_pdi_actions_on_course_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'course_roadmap_item_progress' THEN
    v_assignment_id := NEW.assignment_id;
  ELSIF TG_TABLE_NAME = 'course_questionnaire_attempts' THEN
    v_assignment_id := NEW.assignment_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_assignment_id IS NOT NULL AND public.course_is_completed(v_assignment_id) THEN
    UPDATE pdi_actions
    SET status = 'completed',
        updated_at = NOW()
    WHERE course_assignment_id = v_assignment_id
      AND status <> 'completed';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.sync_pdi_actions_on_course_completion() IS 'Trigger function: when course is completed, marks PDI actions linked to that assignment as completed.';

CREATE TRIGGER pdi_sync_on_roadmap_progress
  AFTER INSERT OR UPDATE ON course_roadmap_item_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pdi_actions_on_course_completion();

CREATE TRIGGER pdi_sync_on_questionnaire_attempt
  AFTER INSERT OR UPDATE ON course_questionnaire_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pdi_actions_on_course_completion();
