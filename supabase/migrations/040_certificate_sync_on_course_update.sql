-- Migration 040: Sync certificate course_name and workload_hours when a course is updated;
-- remove ELEVA- prefix from newly generated certificate codes.

-- 1) Trigger: when course title or workload_hours changes, update all certificates for that course.
CREATE OR REPLACE FUNCTION public.sync_certificates_on_course_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title OR OLD.workload_hours IS DISTINCT FROM NEW.workload_hours THEN
    UPDATE certificates
    SET course_name = NEW.title,
        workload_hours = NEW.workload_hours
    WHERE course_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_certificates_on_course_update ON courses;
CREATE TRIGGER trg_sync_certificates_on_course_update
  AFTER UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_certificates_on_course_update();

COMMENT ON FUNCTION public.sync_certificates_on_course_update() IS 'Keeps certificate course_name and workload_hours in sync when a course is updated.';

-- 2) Certificate code generation: remove ELEVA- prefix (new certificates only; existing unchanged).
DROP FUNCTION IF EXISTS public.generate_certificate_if_eligible(UUID);

CREATE OR REPLACE FUNCTION public.generate_certificate_if_eligible(p_assignment_id UUID)
RETURNS certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert certificates%ROWTYPE;
  v_user_id UUID;
  v_course_id UUID;
  v_tenant_id UUID;
  v_user_name TEXT;
  v_course_name TEXT;
  v_workload INT;
  v_completion_date DATE;
  v_code TEXT;
  my_tenant_id UUID;
  my_role TEXT;
BEGIN
  SELECT p.tenant_id, p.role::text
  INTO my_tenant_id, my_role
  FROM profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF my_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Already have a certificate?
  SELECT * INTO v_cert
  FROM certificates
  WHERE assignment_id = p_assignment_id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_cert;
  END IF;

  -- Course must be completed
  IF NOT public.course_is_completed(p_assignment_id) THEN
    RETURN NULL;
  END IF;

  -- Assignment must exist and belong to same tenant; caller must be owner, HR, or manager with scope
  SELECT a.user_id, a.course_id, c.tenant_id, p.name, c.title, c.workload_hours
  INTO v_user_id, v_course_id, v_tenant_id, v_user_name, v_course_name, v_workload
  FROM course_assignments a
  JOIN courses c ON c.id = a.course_id
  JOIN profiles p ON p.id = a.user_id
  WHERE a.id = p_assignment_id
    AND c.tenant_id = my_tenant_id
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Allow: assignment owner, HR, or manager when assignment user is in scope (team or same department)
  IF v_user_id != auth.uid() AND my_role != 'hr' AND NOT (
    my_role = 'manager'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_user_id
        AND p.tenant_id = my_tenant_id
        AND (p.manager_id = auth.uid() OR (p.department IS NOT NULL AND p.department IS NOT DISTINCT FROM public.get_my_profile_department()))
    )
  ) THEN
    RETURN NULL;
  END IF;

  -- Completion date: latest passed attempt or today (Brazil local date)
  SELECT (MAX(att.submitted_at) AT TIME ZONE 'America/Sao_Paulo')::date INTO v_completion_date
  FROM course_questionnaire_attempts att
  WHERE att.assignment_id = p_assignment_id AND att.passed = true;

  v_completion_date := COALESCE(v_completion_date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date);

  -- Unique code (short, URL-safe; no prefix)
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));

  INSERT INTO certificates (
    assignment_id, user_id, course_id, tenant_id, certificate_code,
    user_name, course_name, workload_hours, completion_date
  )
  VALUES (
    p_assignment_id, v_user_id, v_course_id, v_tenant_id, v_code,
    v_user_name, v_course_name, v_workload, v_completion_date
  )
  RETURNING * INTO v_cert;

  RETURN v_cert;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_certificate_if_eligible(UUID) TO authenticated;
COMMENT ON FUNCTION public.generate_certificate_if_eligible(UUID) IS 'Creates certificate for assignment if course is completed; idempotent. Callable by assignment owner, HR, or manager for users in their scope (team or same department).';
