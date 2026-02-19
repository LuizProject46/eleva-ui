-- Migration 043: Notify all assigned users on any course (optional or mandatory).
-- Add course_assigned notification type; trigger and helper notify on every assignment.

-- Allow course_assigned type (all assignments) in addition to mandatory_course_assigned (kept for backward compatibility).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'evaluation_received',
    'feedback_received',
    'evaluation_period_reminder',
    'assessment_period_reminder',
    'mandatory_course_assigned',
    'course_assigned'
  )
);

-- Notify on any course assignment: insert one in-app notification per assigned user.
CREATE OR REPLACE FUNCTION public.notify_course_assigned(p_assignment_id UUID)
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
  v_course_type TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT c.tenant_id, a.user_id, a.course_id, c.title, COALESCE(c.description, ''), c.type::text
  INTO v_tenant_id, v_user_id, v_course_id, v_course_title, v_course_description, v_course_type
  FROM course_assignments a
  JOIN courses c ON c.id = a.course_id
  WHERE a.id = p_assignment_id
    AND c.deleted_at IS NULL;

  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_title := CASE WHEN v_course_type = 'mandatory' THEN 'Novo curso obrigatório: ' || v_course_title ELSE 'Novo curso atribuído: ' || v_course_title END;
  v_body := CASE WHEN v_course_description = '' THEN 'Inicie o curso.' ELSE left(v_course_description, 200) END;

  INSERT INTO notifications (tenant_id, user_id, type, title, body, related_id)
  VALUES (v_tenant_id, v_user_id, 'course_assigned', v_title, v_body, v_course_id);
END;
$$;

COMMENT ON FUNCTION public.notify_course_assigned(UUID) IS
  'Inserts one in-app notification for the assigned user (any course type). Called from trigger.';

-- Trigger now calls notify_course_assigned so all assignments are notified.
CREATE OR REPLACE FUNCTION public.trg_after_course_assignment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_course_assigned(NEW.id);
  RETURN NEW;
END;
$$;
