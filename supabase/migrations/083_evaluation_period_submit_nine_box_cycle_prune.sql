-- Resolve auto evaluation_period row for current periodicity cycle (submission).
-- Nine-box: auto periods eligible from 2nd cycle in calendar year of auto_cycle_start_date.
-- Prune orphan auto periods (no evaluations / snapshots) after periodicity config changes.

CREATE OR REPLACE FUNCTION public.resolve_evaluation_period_id_for_submission()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_date DATE;
  v_period_start DATE;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.tenant_id
  INTO v_tenant_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;

  SELECT ps.period_start
  INTO v_period_start
  FROM public.get_period_containing_date(v_tenant_id, 'evaluation', v_date) ps
  LIMIT 1;

  IF v_period_start IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.generate_evaluation_periods_for_entity(v_tenant_id, 'evaluation', 2, 6);

  SELECT ep.id
  INTO v_id
  FROM public.evaluation_periods ep
  WHERE ep.tenant_id = v_tenant_id
    AND ep.source_entity_type = 'evaluation'
    AND ep.is_auto_generated = true
    AND ep.auto_cycle_start_date = v_period_start
  LIMIT 1;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.resolve_evaluation_period_id_for_submission() IS
  'Returns evaluation_periods.id for the auto row matching get_period_containing_date today; generates slots if needed.';

REVOKE ALL ON FUNCTION public.resolve_evaluation_period_id_for_submission() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_evaluation_period_id_for_submission() TO authenticated;

CREATE OR REPLACE FUNCTION public.prune_orphan_auto_evaluation_periods(
  p_tenant_id UUID,
  p_entity_type TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF p_entity_type NOT IN ('evaluation', 'assessment') THEN
    RAISE EXCEPTION 'invalid entity_type %', p_entity_type;
  END IF;

  DELETE FROM public.evaluation_periods ep
  WHERE ep.tenant_id = p_tenant_id
    AND ep.source_entity_type = p_entity_type
    AND ep.is_auto_generated = true
    AND NOT EXISTS (
      SELECT 1 FROM public.evaluations e WHERE e.period_id = ep.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.nine_box_competency_snapshots s WHERE s.period_id = ep.id
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.prune_orphan_auto_evaluation_periods(UUID, TEXT) IS
  'Deletes auto-generated evaluation_periods with no evaluations or competency snapshots (service_role / Edge).';

REVOKE ALL ON FUNCTION public.prune_orphan_auto_evaluation_periods(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_orphan_auto_evaluation_periods(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_competency_nine_box_snapshot(p_evaluation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval RECORD;
  v_effective_semester INT;
  v_prior_cycles INT;
  v_cycle_index INT;
  v_nine_box_eligible BOOLEAN := false;
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
    p.starts_at AS period_starts_at,
    COALESCE(p.is_auto_generated, false) AS is_auto_generated,
    p.auto_cycle_start_date
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
     OR v_eval.period_id IS NULL THEN
    RETURN;
  END IF;

  IF v_eval.is_auto_generated = true AND v_eval.auto_cycle_start_date IS NOT NULL THEN
    SELECT COUNT(*)::INT
    INTO v_prior_cycles
    FROM public.evaluation_periods ep
    WHERE ep.tenant_id = v_eval.tenant_id
      AND ep.source_entity_type = 'evaluation'
      AND ep.is_auto_generated = true
      AND ep.auto_cycle_start_date IS NOT NULL
      AND EXTRACT(YEAR FROM ep.auto_cycle_start_date)::INT =
          EXTRACT(YEAR FROM v_eval.auto_cycle_start_date)::INT
      AND ep.auto_cycle_start_date < v_eval.auto_cycle_start_date;

    v_cycle_index := COALESCE(v_prior_cycles, 0) + 1;
    v_nine_box_eligible := (v_cycle_index >= 2);
  ELSE
    v_effective_semester := COALESCE(
      v_eval.semester,
      CASE
        WHEN v_eval.period_starts_at IS NULL THEN 0
        WHEN EXTRACT(MONTH FROM (v_eval.period_starts_at AT TIME ZONE 'UTC'))::INT <= 6 THEN 1
        ELSE 2
      END
    );
    v_nine_box_eligible := (v_effective_semester = 2);
  END IF;

  IF NOT v_nine_box_eligible THEN
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
    WHERE e.tenant_id = p_tenant_id
      AND e.type = 'manager_to_employee'
      AND e.status = 'submitted'
      AND e.period_id IS NOT NULL
      AND (p_period_id IS NULL OR e.period_id = p_period_id)
  LOOP
    PERFORM public.generate_competency_nine_box_snapshot(v_eval.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
