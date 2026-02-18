-- Migration 037: Add optional filters to get_my_certificates (course name, completion date range, certificate code).

DROP FUNCTION IF EXISTS public.get_my_certificates(INT, INT);

CREATE FUNCTION public.get_my_certificates(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_course_name TEXT DEFAULT NULL,
  p_completion_date_from DATE DEFAULT NULL,
  p_completion_date_to DATE DEFAULT NULL,
  p_certificate_code TEXT DEFAULT NULL
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
      AND (p_course_name IS NULL OR NULLIF(trim(p_course_name), '') IS NULL OR c.course_name ILIKE '%' || trim(p_course_name) || '%')
      AND (p_completion_date_from IS NULL OR c.completion_date >= p_completion_date_from)
      AND (p_completion_date_to IS NULL OR c.completion_date <= p_completion_date_to)
      AND (p_certificate_code IS NULL OR NULLIF(trim(p_certificate_code), '') IS NULL OR c.certificate_code ILIKE '%' || trim(p_certificate_code) || '%')
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

GRANT EXECUTE ON FUNCTION public.get_my_certificates(INT, INT, TEXT, DATE, DATE, TEXT) TO authenticated;
COMMENT ON FUNCTION public.get_my_certificates(INT, INT, TEXT, DATE, DATE, TEXT) IS 'Paginated list of current user certificates with optional filters: course name (ILIKE), completion date range, certificate code (ILIKE).';
