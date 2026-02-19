-- Migration 042: In-app notification when an employee is assigned to a mandatory course.
-- Trigger on course_assignments INSERT; helper inserts into notifications (service_role bypass via SECURITY DEFINER).

-- Helper: insert one in-app notification for the assigned user (course name, short description, related_id = course_id).
CREATE OR REPLACE FUNCTION public.notify_mandatory_course_assigned(p_assignment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_course_id UUID;
  v_course_title TEXT;
  v_course_description TEXT;
BEGIN
  SELECT c.tenant_id, a.user_id, a.course_id, c.title, COALESCE(c.description, '')
  INTO v_tenant_id, v_user_id, v_course_id, v_course_title, v_course_description
  FROM course_assignments a
  JOIN courses c ON c.id = a.course_id
  WHERE a.id = p_assignment_id
    AND c.type = 'mandatory'
    AND c.deleted_at IS NULL;

  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO notifications (tenant_id, user_id, type, title, body, related_id)
  VALUES (
    v_tenant_id,
    v_user_id,
    'mandatory_course_assigned',
    'Novo curso obrigatório: ' || v_course_title,
    CASE WHEN v_course_description = '' THEN 'Inicie o curso.' ELSE left(v_course_description, 200) END,
    v_course_id
  );
END;
$$;

COMMENT ON FUNCTION public.notify_mandatory_course_assigned(UUID) IS
  'Inserts one in-app notification for the assigned user when the course is mandatory. Called from trigger.';

-- Trigger: after insert on course_assignments, notify if course is mandatory.
CREATE OR REPLACE FUNCTION public.trg_after_course_assignment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_mandatory_course_assigned(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_course_assignment_insert_notify_mandatory ON course_assignments;
CREATE TRIGGER after_course_assignment_insert_notify_mandatory
  AFTER INSERT ON course_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_after_course_assignment_insert();
