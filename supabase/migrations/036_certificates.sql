-- Migration 036: Course certificates – table, RLS, RPCs, extend admin progress.
-- Certificates are immutable; generated only when course is fully completed (roadmap + passed questionnaire).

-- Drop function that depends on certificates table first (so table can be dropped on re-run)
DROP FUNCTION IF EXISTS public.generate_certificate_if_eligible(UUID) CASCADE;

-- Optional: workload (hours) on courses for certificate display
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS workload_hours INT CHECK (workload_hours IS NULL OR workload_hours > 0);

COMMENT ON COLUMN courses.workload_hours IS 'Course workload in hours; shown on certificate.';

-- Certificates table (one per assignment when course is completed)
DROP TABLE IF EXISTS certificates CASCADE;

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES course_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  certificate_code TEXT NOT NULL UNIQUE,
  user_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  workload_hours INT,
  completion_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_certificates_assignment_id ON certificates(assignment_id);
CREATE INDEX idx_certificates_user_id ON certificates(user_id);
CREATE INDEX idx_certificates_tenant_id ON certificates(tenant_id);
CREATE UNIQUE INDEX idx_certificates_certificate_code ON certificates(certificate_code);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- SELECT: own certificates or HR viewing same tenant
CREATE POLICY "Users can view own certificates" ON certificates
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "HR can view all tenant certificates" ON certificates
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- No INSERT/UPDATE/DELETE via table; only via SECURITY DEFINER RPC
-- (So we do not create any policy that allows direct INSERT.)

-- Generate certificate if course is completed and no certificate exists yet.
-- Callable by assignment owner or HR (same tenant).
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

  -- Assignment must exist and belong to same tenant; caller must be owner or HR
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

  IF v_user_id != auth.uid() AND my_role != 'hr' THEN
    RETURN NULL;
  END IF;

  -- Completion date: latest passed attempt or today (Brazil local date)
  SELECT (MAX(att.submitted_at) AT TIME ZONE 'America/Sao_Paulo')::date INTO v_completion_date
  FROM course_questionnaire_attempts att
  WHERE att.assignment_id = p_assignment_id AND att.passed = true;

  v_completion_date := COALESCE(v_completion_date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date);

  -- Unique code (short, URL-safe)
  v_code := 'ELEVA-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));

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
COMMENT ON FUNCTION public.generate_certificate_if_eligible(UUID) IS 'Creates certificate for assignment if course is completed; idempotent. Callable by assignment owner or HR.';

-- Paginated list of current user certificates (for Certificates page)
CREATE OR REPLACE FUNCTION public.get_my_certificates(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  assignment_id UUID,
  course_name TEXT,
  completion_date DATE,
  certificate_code TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      c.id,
      c.assignment_id,
      c.course_name,
      c.completion_date,
      c.certificate_code
    FROM certificates c
    WHERE c.user_id = auth.uid()
  ),
  with_count AS (
    SELECT base.*, COUNT(*) OVER() AS total_count
    FROM base
  )
  SELECT
    with_count.id,
    with_count.assignment_id,
    with_count.course_name,
    with_count.completion_date,
    with_count.certificate_code,
    with_count.total_count
  FROM with_count
  ORDER BY with_count.completion_date DESC, with_count.course_name
  LIMIT COALESCE(NULLIF(p_limit, 0), 20)
  OFFSET COALESCE(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_certificates(INT, INT) TO authenticated;
COMMENT ON FUNCTION public.get_my_certificates(INT, INT) IS 'Paginated list of current user certificates.';

-- Public verification by code (no auth)
CREATE OR REPLACE FUNCTION public.get_certificate_for_verification(p_code TEXT)
RETURNS TABLE (
  user_name TEXT,
  course_name TEXT,
  completion_date DATE,
  certificate_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NULLIF(trim(p_code), '') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.user_name,
    c.course_name,
    c.completion_date,
    c.certificate_code
  FROM certificates c
  WHERE c.certificate_code = trim(p_code)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_certificate_for_verification(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_certificate_for_verification(TEXT) TO authenticated;
COMMENT ON FUNCTION public.get_certificate_for_verification(TEXT) IS 'Public verification by certificate code.';

-- Extend admin progress RPC to return certificate_id (LEFT JOIN certificates).
-- Drop first because return type (TABLE) changed (added certificate_id).
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
        OR (my_role = 'manager' AND (p.manager_id = auth.uid() OR (p.department IS NOT NULL AND p.department IS NOT DISTINCT FROM my_department)))
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

COMMENT ON FUNCTION public.get_course_assignments_admin_progress(TEXT, TEXT, UUID, INT, INT) IS 'HR/Manager: list assignments with progress and certificate_id. Search (name/course), status and course filters, pagination.';
