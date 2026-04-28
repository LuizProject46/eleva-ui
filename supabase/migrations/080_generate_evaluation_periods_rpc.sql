-- Migration 080: Idempotent generation of evaluation_periods from periodicity_config.
-- Uses same day-based intervals as get_interval_days / get_period_containing_date.
-- SECURITY DEFINER so cron (service_role) can upsert without HR JWT.

CREATE OR REPLACE FUNCTION public._evaluation_period_name_for_cycle(
  p_entity_type TEXT,
  p_cycle_start DATE,
  p_cycle_end_inclusive DATE
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_entity_type
    WHEN 'evaluation' THEN '360° · '
    WHEN 'assessment' THEN 'DISC · '
    ELSE ''
  END
  || to_char(p_cycle_start, 'DD/MM/YYYY')
  || ' – '
  || to_char(p_cycle_end_inclusive, 'DD/MM/YYYY');
$$;

CREATE OR REPLACE FUNCTION public._evaluation_period_semester_for_cycle(
  p_interval_kind TEXT,
  p_cycle_start DATE
)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_interval_kind = 'semiannual' THEN
      CASE WHEN EXTRACT(MONTH FROM p_cycle_start)::INT <= 6 THEN 1 ELSE 2 END
    ELSE NULL
  END;
$$;

-- Returns the cycle [start, end_exclusive) containing p_date, aligned to reference + n * interval_days.
CREATE OR REPLACE FUNCTION public._periodicity_cycle_bounds_for_date(
  p_reference_start DATE,
  p_interval_days INT,
  p_date DATE,
  OUT cycle_start DATE,
  OUT cycle_end_exclusive DATE
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_s DATE;
  v_e DATE;
BEGIN
  IF p_interval_days IS NULL OR p_interval_days < 1 THEN
    cycle_start := NULL;
    cycle_end_exclusive := NULL;
    RETURN;
  END IF;

  v_s := p_reference_start;
  v_e := v_s + p_interval_days;

  IF p_date < p_reference_start THEN
    cycle_start := NULL;
    cycle_end_exclusive := NULL;
    RETURN;
  END IF;

  WHILE v_e <= p_date LOOP
    v_s := v_e;
    v_e := v_s + p_interval_days;
  END LOOP;

  IF p_date >= v_s AND p_date < v_e THEN
    cycle_start := v_s;
    cycle_end_exclusive := v_e;
    RETURN;
  END IF;

  cycle_start := NULL;
  cycle_end_exclusive := NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_evaluation_periods_for_entity(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_past_cycles INT DEFAULT 2,
  p_future_cycles INT DEFAULT 6
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg RECORD;
  v_interval_days INT;
  v_as_of DATE;
  v_c0 DATE;
  v_end_excl DATE;
  v_k INT;
  v_s DATE;
  v_e_excl DATE;
  v_end_incl DATE;
  v_year INT;
  v_semester INT;
  v_name TEXT;
  v_upserted INT := 0;
BEGIN
  IF p_entity_type NOT IN ('evaluation', 'assessment') THEN
    RAISE EXCEPTION 'invalid entity_type %', p_entity_type;
  END IF;

  IF p_past_cycles < 0 OR p_future_cycles < 0 THEN
    RAISE EXCEPTION 'past_cycles and future_cycles must be non-negative';
  END IF;

  SELECT
    reference_start_date,
    interval_kind,
    custom_interval_days,
    custom_interval_months,
    updated_at
  INTO v_cfg
  FROM public.periodicity_config
  WHERE tenant_id = p_tenant_id
    AND entity_type = p_entity_type
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_interval_days := public.get_interval_days(
    v_cfg.interval_kind,
    v_cfg.custom_interval_days,
    v_cfg.custom_interval_months
  );

  v_as_of := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;

  SELECT cycle_start, cycle_end_exclusive
  INTO v_c0, v_end_excl
  FROM public._periodicity_cycle_bounds_for_date(
    v_cfg.reference_start_date,
    v_interval_days,
    v_as_of
  );

  IF v_c0 IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_k IN -p_past_cycles..p_future_cycles LOOP
    v_s := v_c0 + (v_k * v_interval_days);

    IF v_s < v_cfg.reference_start_date THEN
      CONTINUE;
    END IF;

    v_e_excl := v_s + v_interval_days;
    v_end_incl := v_e_excl - 1;
    v_year := EXTRACT(YEAR FROM v_s)::INT;
    v_semester := public._evaluation_period_semester_for_cycle(v_cfg.interval_kind, v_s);
    v_name := public._evaluation_period_name_for_cycle(p_entity_type, v_s, v_end_incl);

    INSERT INTO public.evaluation_periods (
      tenant_id,
      name,
      year,
      semester,
      starts_at,
      ends_at,
      source_entity_type,
      is_auto_generated,
      auto_cycle_start_date,
      auto_interval_kind,
      generated_from_config_at
    )
    VALUES (
      p_tenant_id,
      v_name,
      v_year,
      v_semester,
      (((v_s::TEXT || ' 00:00:00+00')::TIMESTAMPTZ)),
      ((((v_end_incl + 1)::TEXT || ' 00:00:00+00')::TIMESTAMPTZ) - INTERVAL '1 microsecond'),
      p_entity_type,
      true,
      v_s,
      v_cfg.interval_kind,
      v_cfg.updated_at
    )
    ON CONFLICT (tenant_id, source_entity_type, auto_cycle_start_date)
      WHERE is_auto_generated = true
        AND auto_cycle_start_date IS NOT NULL
        AND source_entity_type IS NOT NULL
    DO UPDATE SET
      name = EXCLUDED.name,
      year = EXCLUDED.year,
      semester = EXCLUDED.semester,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      auto_interval_kind = EXCLUDED.auto_interval_kind,
      generated_from_config_at = EXCLUDED.generated_from_config_at;

    v_upserted := v_upserted + 1;
  END LOOP;

  RETURN v_upserted;
END;
$$;

COMMENT ON FUNCTION public.generate_evaluation_periods_for_entity(UUID, TEXT, INT, INT) IS
  'Upserts auto evaluation_periods for one tenant and periodicity entity_type; returns number of cycles processed.';

CREATE OR REPLACE FUNCTION public.generate_evaluation_periods_all_tenants(
  p_past_cycles INT DEFAULT 2,
  p_future_cycles INT DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_n INT;
  v_total_cycles INT := 0;
  v_tenants INT := 0;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  FOR v_row IN
    SELECT DISTINCT tenant_id, entity_type
    FROM public.periodicity_config
  LOOP
    BEGIN
      v_n := public.generate_evaluation_periods_for_entity(
        v_row.tenant_id,
        v_row.entity_type,
        p_past_cycles,
        p_future_cycles
      );
      v_total_cycles := v_total_cycles + v_n;
      v_tenants := v_tenants + 1;
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'tenant_id', v_row.tenant_id,
            'entity_type', v_row.entity_type,
            'message', SQLERRM
          )
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'configs_processed', v_tenants,
    'cycle_slots_upserted', v_total_cycles,
    'errors', v_errors
  );
END;
$$;

COMMENT ON FUNCTION public.generate_evaluation_periods_all_tenants(INT, INT) IS
  'Runs generate_evaluation_periods_for_entity for each row in periodicity_config; for cron / Edge Function.';

REVOKE ALL ON FUNCTION public.generate_evaluation_periods_for_entity(UUID, TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_evaluation_periods_all_tenants(INT, INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_evaluation_periods_for_entity(UUID, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_evaluation_periods_all_tenants(INT, INT) TO service_role;
