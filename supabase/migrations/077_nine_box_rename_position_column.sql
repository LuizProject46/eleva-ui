-- Repair: PostgreSQL reserves `position` (built-in function); RETURNS TABLE (position TEXT) fails.
-- If 076 was partially applied with column `position`, rename it and refresh dependent functions.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nine_box_competency_snapshots'
      AND column_name = 'position'
  ) THEN
    ALTER TABLE public.nine_box_competency_snapshots RENAME COLUMN position TO box_position;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_competency_nine_box_snapshot(p_evaluation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval RECORD;
  v_customer_focus NUMERIC(5,2);
  v_innovation NUMERIC(5,2);
  v_engagement NUMERIC(5,2);
  v_leadership NUMERIC(5,2);
  v_ethics NUMERIC(5,2);
  v_performance_score NUMERIC(5,2);
  v_potential_score NUMERIC(5,2);
  v_performance_level public.nine_box_axis_level;
  v_potential_level public.nine_box_axis_level;
  v_position TEXT;
  v_missing TEXT[] := '{}'::TEXT[];
  v_snapshot_status TEXT := 'complete';
BEGIN
  SELECT
    e.id,
    e.tenant_id,
    e.evaluated_id AS employee_id,
    e.period_id,
    e.type,
    e.status,
    p.semester
  INTO v_eval
  FROM public.evaluations e
  LEFT JOIN public.evaluation_periods p ON p.id = e.period_id
  WHERE e.id = p_evaluation_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_eval.type <> 'manager_to_employee'::public.evaluation_type
     OR v_eval.status <> 'submitted'
     OR v_eval.period_id IS NULL
     OR COALESCE(v_eval.semester, 0) <> 2 THEN
    RETURN;
  END IF;

  SELECT
    MAX(CASE WHEN s.competency_id = 'foco_cliente' THEN ROUND((s.score::NUMERIC / 5) * 100, 2) END),
    MAX(CASE WHEN s.competency_id = 'melhoria_continua' THEN ROUND((s.score::NUMERIC / 5) * 100, 2) END),
    MAX(CASE WHEN s.competency_id = 'comprometimento' THEN ROUND((s.score::NUMERIC / 5) * 100, 2) END),
    MAX(CASE WHEN s.competency_id = 'trabalho_equipe' THEN ROUND((s.score::NUMERIC / 5) * 100, 2) END),
    MAX(CASE WHEN s.competency_id = 'etica_responsabilidade' THEN ROUND((s.score::NUMERIC / 5) * 100, 2) END)
  INTO
    v_customer_focus,
    v_innovation,
    v_engagement,
    v_leadership,
    v_ethics
  FROM public.evaluation_scores s
  JOIN public.evaluation_competency_axis_map m
    ON m.competency_id = s.competency_id
   AND m.is_active = true
  WHERE s.evaluation_id = p_evaluation_id;

  IF v_customer_focus IS NULL THEN
    v_missing := array_append(v_missing, 'foco_cliente');
  END IF;
  IF v_ethics IS NULL THEN
    v_missing := array_append(v_missing, 'etica_responsabilidade');
  END IF;
  IF v_innovation IS NULL THEN
    v_missing := array_append(v_missing, 'melhoria_continua');
  END IF;
  IF v_engagement IS NULL THEN
    v_missing := array_append(v_missing, 'comprometimento');
  END IF;
  IF v_leadership IS NULL THEN
    v_missing := array_append(v_missing, 'trabalho_equipe');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    v_snapshot_status := 'incomplete';
    v_performance_score := NULL;
    v_potential_score := NULL;
    v_performance_level := NULL;
    v_potential_level := NULL;
    v_position := NULL;
  ELSE
    v_snapshot_status := 'complete';
    v_performance_score := ROUND((v_customer_focus + v_ethics) / 2, 2);
    v_potential_score := ROUND((v_innovation + v_engagement + v_leadership) / 3, 2);
    v_performance_level := public.nine_box_axis_level_from_score(v_performance_score);
    v_potential_level := public.nine_box_axis_level_from_score(v_potential_score);
    v_position :=
      UPPER(v_performance_level::TEXT) || '_PERFORMANCE/' ||
      UPPER(v_potential_level::TEXT) || '_POTENTIAL';
  END IF;

  INSERT INTO public.nine_box_competency_snapshots (
    tenant_id,
    employee_id,
    evaluation_id,
    period_id,
    source_type,
    calculation_version,
    snapshot_status,
    customer_focus_score,
    innovation_score,
    engagement_score,
    leadership_score,
    ethics_score,
    performance_score,
    potential_score,
    performance_level,
    potential_level,
    box_position,
    missing_competencies,
    generated_at,
    updated_at
  ) VALUES (
    v_eval.tenant_id,
    v_eval.employee_id,
    v_eval.id,
    v_eval.period_id,
    'manager_to_employee'::public.evaluation_type,
    1,
    v_snapshot_status,
    v_customer_focus,
    v_innovation,
    v_engagement,
    v_leadership,
    v_ethics,
    v_performance_score,
    v_potential_score,
    v_performance_level,
    v_potential_level,
    v_position,
    v_missing,
    NOW(),
    NOW()
  )
  ON CONFLICT (tenant_id, employee_id, period_id, source_type, calculation_version)
  DO UPDATE
  SET
    evaluation_id = EXCLUDED.evaluation_id,
    snapshot_status = EXCLUDED.snapshot_status,
    customer_focus_score = EXCLUDED.customer_focus_score,
    innovation_score = EXCLUDED.innovation_score,
    engagement_score = EXCLUDED.engagement_score,
    leadership_score = EXCLUDED.leadership_score,
    ethics_score = EXCLUDED.ethics_score,
    performance_score = EXCLUDED.performance_score,
    potential_score = EXCLUDED.potential_score,
    performance_level = EXCLUDED.performance_level,
    potential_level = EXCLUDED.potential_level,
    box_position = EXCLUDED.box_position,
    missing_competencies = EXCLUDED.missing_competencies,
    generated_at = EXCLUDED.generated_at,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_competency_nine_box_matrix(
  p_tenant_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  performance public.nine_box_axis_level,
  potential public.nine_box_axis_level,
  notes TEXT,
  evaluated_by UUID,
  updated_at TIMESTAMPTZ,
  performance_score NUMERIC(5,2),
  potential_score NUMERIC(5,2),
  box_position TEXT,
  snapshot_status TEXT,
  missing_competencies TEXT[],
  source_mode TEXT,
  period_id UUID,
  profiles JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_my_tenant UUID;
BEGIN
  v_role := public.get_my_profile_role();
  v_my_tenant := public.get_my_profile_tenant_id();

  IF v_role NOT IN ('hr', 'manager') OR v_my_tenant IS DISTINCT FROM p_tenant_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH latest_per_employee AS (
    SELECT DISTINCT ON (s.employee_id)
      s.*
    FROM public.nine_box_competency_snapshots s
    WHERE s.tenant_id = p_tenant_id
      AND s.period_id = p_period_id
      AND s.snapshot_status = 'complete'
    ORDER BY s.employee_id, s.calculation_version DESC, s.generated_at DESC
  )
  SELECT
    l.id,
    l.employee_id,
    l.performance_level AS performance,
    l.potential_level AS potential,
    NULL::TEXT AS notes,
    l.evaluation_id AS evaluated_by,
    l.updated_at,
    l.performance_score,
    l.potential_score,
    l.box_position,
    l.snapshot_status,
    l.missing_competencies,
    'competency'::TEXT AS source_mode,
    l.period_id,
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'department', p.department,
      'avatar_url', p.avatar_url,
      'avatar_thumb_url', p.avatar_thumb_url
    ) AS profiles
  FROM latest_per_employee l
  JOIN public.profiles p ON p.id = l.employee_id
  WHERE (
    v_role = 'hr'
    OR (
      v_role = 'manager'
      AND p.manager_id = auth.uid()
      AND p.tenant_id = p_tenant_id
    )
  )
  ORDER BY l.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_competency_nine_box_matrix(UUID, UUID) TO authenticated;
