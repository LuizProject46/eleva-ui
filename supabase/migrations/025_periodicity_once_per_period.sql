-- Migration 025: Enforce once-per-period for behavioral assessments and evaluations.
-- Uses periodicity_config to compute the period; blocks duplicate completion/submission in the same period.

-- Helper: interval days from config fields (mirrors src/lib/periodicity.ts and Edge Function).
CREATE OR REPLACE FUNCTION public.get_interval_days(
  p_interval_kind TEXT,
  p_custom_interval_days INT,
  p_custom_interval_months INT
)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_interval_kind = 'bimonthly' THEN RETURN 60; END IF;
  IF p_interval_kind = 'quarterly' THEN RETURN 90; END IF;
  IF p_interval_kind = 'semiannual' THEN RETURN 180; END IF;
  IF p_interval_kind = 'annual' THEN RETURN 360; END IF;
  IF p_interval_kind = 'custom' THEN
    IF p_custom_interval_days IS NOT NULL AND p_custom_interval_days >= 1 THEN
      RETURN p_custom_interval_days;
    END IF;
    IF p_custom_interval_months IS NOT NULL AND p_custom_interval_months >= 1 THEN
      RETURN p_custom_interval_months * 30;
    END IF;
    RETURN 180;
  END IF;
  RETURN 180;
END;
$$;

-- Returns the period (start and end date, inclusive) that contains p_date for the tenant's entity_type config.
-- If no config, returns NULL (caller treats as "no restriction").
CREATE OR REPLACE FUNCTION public.get_period_containing_date(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_date DATE
)
RETURNS TABLE(period_start DATE, period_end DATE)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_ref DATE;
  v_interval_days INT;
  v_period_start DATE;
  v_period_end DATE;
  v_c record;
BEGIN
  SELECT reference_start_date, interval_kind, custom_interval_days, custom_interval_months
  INTO v_c
  FROM periodicity_config
  WHERE tenant_id = p_tenant_id AND entity_type = p_entity_type
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_ref := v_c.reference_start_date;
  v_interval_days := get_interval_days(v_c.interval_kind, v_c.custom_interval_days, v_c.custom_interval_months);
  v_period_start := v_ref;
  v_period_end := v_period_start + (v_interval_days - 1);

  WHILE v_period_end < p_date LOOP
    v_period_start := v_period_end + 1;
    v_period_end := v_period_start + (v_interval_days - 1);
  END LOOP;

  IF p_date >= v_period_start AND p_date <= v_period_end THEN
    period_start := v_period_start;
    period_end := v_period_end;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;

-- Returns the start date of the next period (for error messages). Same config as get_period_containing_date.
CREATE OR REPLACE FUNCTION public.get_next_period_start(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_date DATE
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_interval_days INT;
  v_period_start DATE;
  v_period_end DATE;
  v_c record;
BEGIN
  SELECT reference_start_date, interval_kind, custom_interval_days, custom_interval_months
  INTO v_c
  FROM periodicity_config
  WHERE tenant_id = p_tenant_id AND entity_type = p_entity_type
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_interval_days := get_interval_days(v_c.interval_kind, v_c.custom_interval_days, v_c.custom_interval_months);
  v_period_start := v_c.reference_start_date;
  v_period_end := v_period_start + (v_interval_days - 1);

  WHILE v_period_end < p_date LOOP
    v_period_start := v_period_end + 1;
    v_period_end := v_period_start + (v_interval_days - 1);
  END LOOP;

  RETURN v_period_end + 1;
END;
$$;

-- Behavioral: raise if user already completed in the period containing p_completed_at (excluding p_exclude_id for UPDATE).
CREATE OR REPLACE FUNCTION public.check_behavioral_once_per_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_next_start DATE;
  v_exists BOOLEAN;
BEGIN
  IF NEW.status <> 'completed' OR NEW.completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ps.period_start, ps.period_end INTO v_period_start, v_period_end
  FROM get_period_containing_date(NEW.tenant_id, 'assessment', (NEW.completed_at AT TIME ZONE 'UTC')::date) ps;

  IF v_period_start IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM behavioral_assessments ba
    WHERE ba.user_id = NEW.user_id
      AND ba.completed_at IS NOT NULL
      AND (ba.completed_at AT TIME ZONE 'UTC')::date >= v_period_start
      AND (ba.completed_at AT TIME ZONE 'UTC')::date <= v_period_end
      AND (TG_OP = 'INSERT' OR ba.id <> NEW.id)
  ) INTO v_exists;

  IF v_exists THEN
    v_next_start := get_next_period_start(NEW.tenant_id, 'assessment', (NEW.completed_at AT TIME ZONE 'UTC')::date);
    RAISE EXCEPTION 'Teste comportamental já realizado neste período. Próximo disponível em %.',
      to_char(v_next_start, 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_behavioral_once_per_period ON behavioral_assessments;
CREATE TRIGGER trg_check_behavioral_once_per_period
  BEFORE INSERT OR UPDATE OF status, completed_at ON behavioral_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_behavioral_once_per_period();

-- Evaluations: raise if same (evaluator, evaluated, type) already has a submitted evaluation in the period containing p_submitted_at.
CREATE OR REPLACE FUNCTION public.check_evaluation_once_per_collaborator_per_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_next_start DATE;
  v_exists BOOLEAN;
  v_submitted_date DATE;
BEGIN
  IF NEW.status <> 'submitted' OR NEW.submitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_submitted_date := (NEW.submitted_at AT TIME ZONE 'UTC')::date;

  SELECT ps.period_start, ps.period_end INTO v_period_start, v_period_end
  FROM get_period_containing_date(NEW.tenant_id, 'evaluation', v_submitted_date) ps;

  IF v_period_start IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM evaluations e
    WHERE e.evaluator_id = NEW.evaluator_id
      AND e.evaluated_id = NEW.evaluated_id
      AND e.type = NEW.type
      AND e.status = 'submitted'
      AND e.submitted_at IS NOT NULL
      AND (e.submitted_at AT TIME ZONE 'UTC')::date >= v_period_start
      AND (e.submitted_at AT TIME ZONE 'UTC')::date <= v_period_end
      AND (TG_OP = 'INSERT' OR e.id <> NEW.id)
  ) INTO v_exists;

  IF v_exists THEN
    v_next_start := get_next_period_start(NEW.tenant_id, 'evaluation', v_submitted_date);
    RAISE EXCEPTION 'Você já enviou esta avaliação ou feedback para este colaborador neste período. Próximo disponível em %.',
      to_char(v_next_start, 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_evaluation_once_per_period ON evaluations;
CREATE TRIGGER trg_check_evaluation_once_per_period
  BEFORE INSERT OR UPDATE OF status, submitted_at ON evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_evaluation_once_per_collaborator_per_period();
