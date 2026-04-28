-- Competency 9-box: treat 2nd calendar half as "semester 2" when semester is NULL
-- (auto-generated periods only set semester for semiannual periodicity).

CREATE OR REPLACE FUNCTION public.generate_competency_nine_box_snapshot(p_evaluation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval RECORD;
  v_effective_semester INT;
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
    p.semester,
    p.starts_at AS period_starts_at
  INTO v_eval
  FROM public.evaluations e
  LEFT JOIN public.evaluation_periods p ON p.id = e.period_id
  WHERE e.id = p_evaluation_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_effective_semester := COALESCE(
    v_eval.semester,
    CASE
      WHEN v_eval.period_starts_at IS NULL THEN 0
      WHEN EXTRACT(MONTH FROM (v_eval.period_starts_at AT TIME ZONE 'UTC'))::INT <= 6 THEN 1
      ELSE 2
    END
  );

  IF v_eval.type <> 'manager_to_employee'::public.evaluation_type
     OR v_eval.status <> 'submitted'
     OR v_eval.period_id IS NULL
     OR v_effective_semester <> 2 THEN
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

CREATE OR REPLACE FUNCTION public.backfill_competency_nine_box_snapshots(
  p_tenant_id UUID,
  p_period_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_eval RECORD;
BEGIN
  FOR v_eval IN
    SELECT e.id
    FROM public.evaluations e
    JOIN public.evaluation_periods ep ON ep.id = e.period_id
    WHERE e.tenant_id = p_tenant_id
      AND e.type = 'manager_to_employee'
      AND e.status = 'submitted'
      AND (
        ep.semester = 2
        OR (
          ep.semester IS NULL
          AND EXTRACT(MONTH FROM (ep.starts_at AT TIME ZONE 'UTC'))::INT > 6
        )
      )
      AND (p_period_id IS NULL OR e.period_id = p_period_id)
  LOOP
    PERFORM public.generate_competency_nine_box_snapshot(v_eval.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
