-- Migration 089: Annual Nine-Box matrix from performance modules (objectives + competencies).
-- Adds tenant configuration for thresholds and a read RPC with HR/manager scope.

CREATE TABLE public.nine_box_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  evaluation_year INT NOT NULL
    CHECK (evaluation_year >= 2000 AND evaluation_year <= 2100),
  objectives_low_max NUMERIC(4,2) NOT NULL DEFAULT 1.50
    CHECK (objectives_low_max >= 1 AND objectives_low_max <= 3),
  objectives_medium_max NUMERIC(4,2) NOT NULL DEFAULT 2.30
    CHECK (objectives_medium_max > 1 AND objectives_medium_max <= 3),
  competencies_low_max NUMERIC(4,2) NOT NULL DEFAULT 1.50
    CHECK (competencies_low_max >= 1 AND competencies_low_max <= 3),
  competencies_medium_max NUMERIC(4,2) NOT NULL DEFAULT 2.30
    CHECK (competencies_medium_max > 1 AND competencies_medium_max <= 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nine_box_config_tenant_unique UNIQUE (tenant_id),
  CONSTRAINT nine_box_config_objectives_thresholds_valid CHECK (
    objectives_low_max < objectives_medium_max
  ),
  CONSTRAINT nine_box_config_competencies_thresholds_valid CHECK (
    competencies_low_max < competencies_medium_max
  )
);

COMMENT ON TABLE public.nine_box_config IS
  'Annual Nine-Box thresholds per tenant. Used to classify objectives (X) and competencies (Y) scores.';

CREATE OR REPLACE FUNCTION public.nine_box_config_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER nine_box_config_set_updated_at
  BEFORE UPDATE ON public.nine_box_config
  FOR EACH ROW
  EXECUTE FUNCTION public.nine_box_config_set_updated_at();

INSERT INTO public.nine_box_config (
  tenant_id,
  evaluation_year,
  objectives_low_max,
  objectives_medium_max,
  competencies_low_max,
  competencies_medium_max
)
SELECT
  t.id,
  EXTRACT(YEAR FROM CURRENT_DATE)::INT,
  1.50,
  2.30,
  1.50,
  2.30
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

ALTER TABLE public.nine_box_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can select nine_box_config"
  ON public.nine_box_config
  FOR SELECT
  USING (tenant_id = public.get_my_profile_tenant_id());

CREATE POLICY "HR can insert nine_box_config"
  ON public.nine_box_config
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "HR can update nine_box_config"
  ON public.nine_box_config
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "HR can delete nine_box_config"
  ON public.nine_box_config
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nine_box_config TO authenticated;

CREATE OR REPLACE FUNCTION public.nine_box_axis_level_by_threshold(
  p_score NUMERIC,
  p_low_max NUMERIC,
  p_medium_max NUMERIC
)
RETURNS public.nine_box_axis_level
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_score IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_score <= p_low_max THEN
    RETURN 'low'::public.nine_box_axis_level;
  END IF;
  IF p_score <= p_medium_max THEN
    RETURN 'medium'::public.nine_box_axis_level;
  END IF;
  RETURN 'high'::public.nine_box_axis_level;
END;
$$;

COMMENT ON FUNCTION public.nine_box_axis_level_by_threshold(NUMERIC, NUMERIC, NUMERIC) IS
  'Maps a 1..3 score into low|medium|high using tenant-configured threshold maxima.';

CREATE OR REPLACE FUNCTION public.get_performance_nine_box_matrix(
  p_tenant_id UUID,
  p_year INT DEFAULT NULL
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
  profiles JSONB,
  objectives_score NUMERIC(5,2),
  competencies_score NUMERIC(5,2),
  evaluation_year INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_role public.user_role;
  v_my_tenant UUID;
  v_catalog_total INT;
BEGIN
  v_role := public.get_my_profile_role();
  v_my_tenant := public.get_my_profile_tenant_id();

  IF v_role NOT IN ('hr', 'manager') OR v_my_tenant IS DISTINCT FROM p_tenant_id THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INT
  INTO v_catalog_total
  FROM public.evaluation_competencies;

  IF v_catalog_total <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH cfg AS (
    SELECT
      c.tenant_id,
      COALESCE(p_year, c.evaluation_year) AS evaluation_year,
      c.objectives_low_max,
      c.objectives_medium_max,
      c.competencies_low_max,
      c.competencies_medium_max
    FROM public.nine_box_config c
    WHERE c.tenant_id = p_tenant_id
    LIMIT 1
  ),
  scoped_employees AS (
    SELECT p.id, p.name, p.department, p.avatar_url, p.avatar_thumb_url, p.manager_id
    FROM public.profiles p
    WHERE p.tenant_id = p_tenant_id
      AND p.role = 'employee'::public.user_role
      AND p.is_active = true
      AND (
        v_role = 'hr'
        OR (v_role = 'manager' AND p.manager_id = auth.uid())
      )
  ),
  objective_agg AS (
    SELECT
      po.employee_id,
      COUNT(*)::INT AS objective_count,
      COUNT(*) FILTER (WHERE po.rating BETWEEN 1 AND 3)::INT AS rated_count,
      COALESCE(SUM(po.item_weight), 0) AS weight_total,
      COALESCE(SUM((po.rating::NUMERIC) * po.item_weight), 0) AS weighted_total,
      MAX(po.updated_at) AS updated_at
    FROM public.performance_objectives po
    JOIN scoped_employees se ON se.id = po.employee_id
    WHERE po.tenant_id = p_tenant_id
    GROUP BY po.employee_id
  ),
  objective_complete AS (
    SELECT
      oa.employee_id,
      ROUND((oa.weighted_total / NULLIF(oa.weight_total, 0))::NUMERIC, 2) AS objectives_score,
      oa.updated_at
    FROM objective_agg oa
    WHERE oa.objective_count > 0
      AND oa.rated_count = oa.objective_count
      AND ABS(oa.weight_total - 100) <= 0.0001
  ),
  competency_eval_agg AS (
    SELECT
      ev.employee_id,
      COUNT(DISTINCT ev.competency_id) FILTER (
        WHERE ev.rating BETWEEN 1 AND 3
          AND ev.competency_id IN (SELECT id FROM public.evaluation_competencies)
      )::INT AS rated_catalog_count
    FROM public.performance_competency_evaluations ev
    JOIN scoped_employees se ON se.id = ev.employee_id
    WHERE ev.tenant_id = p_tenant_id
    GROUP BY ev.employee_id
  ),
  competency_assignment_agg AS (
    SELECT
      a.employee_id,
      COUNT(*)::INT AS assignment_count,
      COUNT(*) FILTER (WHERE ev.rating BETWEEN 1 AND 3)::INT AS assignment_rated_count,
      COALESCE(SUM(a.item_weight), 0) AS weight_total,
      COALESCE(SUM((ev.rating::NUMERIC) * a.item_weight), 0) AS weighted_total,
      GREATEST(MAX(a.updated_at), MAX(ev.updated_at)) AS updated_at
    FROM public.performance_competency_assignments a
    JOIN scoped_employees se ON se.id = a.employee_id
    LEFT JOIN public.performance_competency_evaluations ev
      ON ev.employee_id = a.employee_id
     AND ev.competency_id = a.competency_id
     AND ev.tenant_id = p_tenant_id
    WHERE a.tenant_id = p_tenant_id
    GROUP BY a.employee_id
  ),
  competency_complete AS (
    SELECT
      ca.employee_id,
      ROUND((ca.weighted_total / NULLIF(ca.weight_total, 0))::NUMERIC, 2) AS competencies_score,
      ca.updated_at
    FROM competency_assignment_agg ca
    JOIN competency_eval_agg ce ON ce.employee_id = ca.employee_id
    WHERE ce.rated_catalog_count = v_catalog_total
      AND ca.assignment_count > 0
      AND ca.assignment_rated_count = ca.assignment_count
      AND ABS(ca.weight_total - 1) <= 0.0001
  )
  SELECT
    se.id AS id,
    se.id AS employee_id,
    public.nine_box_axis_level_by_threshold(
      cc.competencies_score,
      cfg.competencies_low_max,
      cfg.competencies_medium_max
    ) AS performance,
    public.nine_box_axis_level_by_threshold(
      oc.objectives_score,
      cfg.objectives_low_max,
      cfg.objectives_medium_max
    ) AS potential,
    NULL::TEXT AS notes,
    se.manager_id AS evaluated_by,
    GREATEST(oc.updated_at, cc.updated_at) AS updated_at,
    cc.competencies_score AS performance_score,
    oc.objectives_score AS potential_score,
    (
      UPPER(
        public.nine_box_axis_level_by_threshold(
          cc.competencies_score,
          cfg.competencies_low_max,
          cfg.competencies_medium_max
        )::TEXT
      )
      || '_COMPETENCIES/'
      || UPPER(
        public.nine_box_axis_level_by_threshold(
          oc.objectives_score,
          cfg.objectives_low_max,
          cfg.objectives_medium_max
        )::TEXT
      )
      || '_OBJECTIVES'
    ) AS box_position,
    'complete'::TEXT AS snapshot_status,
    '{}'::TEXT[] AS missing_competencies,
    'performance_modules'::TEXT AS source_mode,
    NULL::UUID AS period_id,
    jsonb_build_object(
      'id', se.id,
      'name', se.name,
      'department', se.department,
      'avatar_url', se.avatar_url,
      'avatar_thumb_url', se.avatar_thumb_url
    ) AS profiles,
    oc.objectives_score AS objectives_score,
    cc.competencies_score AS competencies_score,
    cfg.evaluation_year AS evaluation_year
  FROM scoped_employees se
  JOIN objective_complete oc ON oc.employee_id = se.id
  JOIN competency_complete cc ON cc.employee_id = se.id
  CROSS JOIN cfg
  ORDER BY GREATEST(oc.updated_at, cc.updated_at) DESC, se.name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_performance_nine_box_matrix(UUID, INT) IS
  'Returns annual Nine-Box rows from objectives (X) and competencies (Y), including only complete evaluations.';

GRANT EXECUTE ON FUNCTION public.get_performance_nine_box_matrix(UUID, INT) TO authenticated;
