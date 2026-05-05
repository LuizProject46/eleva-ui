-- Migration 088: Performance competencies module for Nine-Box Phase 2.
-- New independent structure for:
-- 1) Employee competency assignment (max 5, weighted, from evaluation_competencies)
-- 2) Manager competency evaluation (rating 1-3 + optional comment)
-- 3) Explicit submission gate requiring full catalog evaluation

CREATE TABLE public.performance_competency_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.evaluation_competencies(id) ON DELETE RESTRICT,
  item_weight NUMERIC(12, 4) NOT NULL
    CONSTRAINT performance_competency_assignments_item_weight_range
      CHECK (item_weight > 0 AND item_weight <= 1),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT performance_competency_assignments_employee_competency_unique
    UNIQUE (employee_id, competency_id)
);

CREATE INDEX idx_performance_competency_assignments_tenant_employee
  ON public.performance_competency_assignments (tenant_id, employee_id);

CREATE TABLE public.performance_competency_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES public.evaluation_competencies(id) ON DELETE RESTRICT,
  rating SMALLINT
    CONSTRAINT performance_competency_evaluations_rating_level
      CHECK (rating IS NULL OR (rating >= 1 AND rating <= 3)),
  manager_comment TEXT,
  rated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rated_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT performance_competency_evaluations_employee_competency_unique
    UNIQUE (employee_id, competency_id)
);

CREATE INDEX idx_performance_competency_evaluations_tenant_employee
  ON public.performance_competency_evaluations (tenant_id, employee_id);

COMMENT ON TABLE public.performance_competency_assignments IS
  'Weighted competency assignments per employee (max 5), sourced from evaluation_competencies.';

COMMENT ON TABLE public.performance_competency_evaluations IS
  'Manager competency evaluations per employee and competency, with explicit submission metadata.';

CREATE OR REPLACE FUNCTION public.performance_competency_assignments_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_tenant UUID;
  v_employee_role public.user_role;
  v_count INT;
  v_total_weight NUMERIC(12, 4);
BEGIN
  SELECT tenant_id, role
    INTO v_employee_tenant, v_employee_role
  FROM public.profiles
  WHERE id = NEW.employee_id
  LIMIT 1;

  IF v_employee_tenant IS NULL THEN
    RAISE EXCEPTION 'performance_competency_assignments: employee not found or missing tenant';
  END IF;
  IF v_employee_role IS DISTINCT FROM 'employee'::public.user_role THEN
    RAISE EXCEPTION 'performance_competency_assignments: employee_id must belong to an employee profile';
  END IF;

  NEW.tenant_id := v_employee_tenant;

  SELECT COUNT(*)::INT, COALESCE(SUM(item_weight), 0)
    INTO v_count, v_total_weight
  FROM public.performance_competency_assignments
  WHERE tenant_id = NEW.tenant_id
    AND employee_id = NEW.employee_id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'performance_competency_assignments: maximum 5 competencies per employee';
  END IF;

  IF (v_total_weight + NEW.item_weight) > 1 THEN
    RAISE EXCEPTION 'performance_competency_assignments: total assigned weight cannot exceed 1.0';
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER performance_competency_assignments_before_insert
  BEFORE INSERT ON public.performance_competency_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_competency_assignments_before_insert();

CREATE OR REPLACE FUNCTION public.performance_competency_assignments_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total_weight NUMERIC(12, 4);
BEGIN
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'performance_competency_assignments: employee_id cannot be changed';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'performance_competency_assignments: tenant_id cannot be changed';
  END IF;
  IF NEW.competency_id IS DISTINCT FROM OLD.competency_id THEN
    RAISE EXCEPTION 'performance_competency_assignments: competency_id cannot be changed';
  END IF;

  SELECT COALESCE(SUM(item_weight), 0)
    INTO v_total_weight
  FROM public.performance_competency_assignments
  WHERE employee_id = OLD.employee_id
    AND id <> OLD.id;

  IF (v_total_weight + NEW.item_weight) > 1 THEN
    RAISE EXCEPTION 'performance_competency_assignments: total assigned weight cannot exceed 1.0';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER performance_competency_assignments_before_update
  BEFORE UPDATE ON public.performance_competency_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_competency_assignments_before_update();

CREATE OR REPLACE FUNCTION public.performance_competency_evaluations_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_tenant UUID;
  v_employee_role public.user_role;
BEGIN
  SELECT tenant_id, role
    INTO v_employee_tenant, v_employee_role
  FROM public.profiles
  WHERE id = NEW.employee_id
  LIMIT 1;

  IF v_employee_tenant IS NULL THEN
    RAISE EXCEPTION 'performance_competency_evaluations: employee not found or missing tenant';
  END IF;
  IF v_employee_role IS DISTINCT FROM 'employee'::public.user_role THEN
    RAISE EXCEPTION 'performance_competency_evaluations: employee_id must belong to an employee profile';
  END IF;

  NEW.tenant_id := v_employee_tenant;

  IF NEW.rating IS NULL THEN
    NEW.rated_by := NULL;
    NEW.rated_at := NULL;
  ELSE
    NEW.rated_by := COALESCE(NEW.rated_by, auth.uid());
    NEW.rated_at := COALESCE(NEW.rated_at, NOW());
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER performance_competency_evaluations_before_insert
  BEFORE INSERT ON public.performance_competency_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_competency_evaluations_before_insert();

CREATE OR REPLACE FUNCTION public.performance_competency_evaluations_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'performance_competency_evaluations: employee_id cannot be changed';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'performance_competency_evaluations: tenant_id cannot be changed';
  END IF;
  IF NEW.competency_id IS DISTINCT FROM OLD.competency_id THEN
    RAISE EXCEPTION 'performance_competency_evaluations: competency_id cannot be changed';
  END IF;

  IF NEW.rating IS NULL THEN
    NEW.rated_by := NULL;
    NEW.rated_at := NULL;
    NEW.submitted_by := NULL;
    NEW.submitted_at := NULL;
  ELSIF NEW.rating IS DISTINCT FROM OLD.rating THEN
    NEW.rated_by := auth.uid();
    NEW.rated_at := NOW();
    NEW.submitted_by := NULL;
    NEW.submitted_at := NULL;
  ELSIF NEW.manager_comment IS DISTINCT FROM OLD.manager_comment THEN
    NEW.submitted_by := NULL;
    NEW.submitted_at := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER performance_competency_evaluations_before_update
  BEFORE UPDATE ON public.performance_competency_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_competency_evaluations_before_update();

CREATE OR REPLACE FUNCTION public.performance_competencies_submit(p_employee_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_my_tenant UUID;
  v_employee_tenant UUID;
  v_employee_manager UUID;
  v_assignments_count INT;
  v_assigned_total NUMERIC(12, 4);
  v_total_competencies INT;
  v_rated_competencies INT;
BEGIN
  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'performance_competencies_submit: employee is required';
  END IF;

  v_role := public.get_my_profile_role();
  v_my_tenant := public.get_my_profile_tenant_id();

  SELECT tenant_id, manager_id
    INTO v_employee_tenant, v_employee_manager
  FROM public.profiles
  WHERE id = p_employee_id
  LIMIT 1;

  IF v_employee_tenant IS NULL THEN
    RAISE EXCEPTION 'performance_competencies_submit: employee not found';
  END IF;
  IF v_employee_tenant IS DISTINCT FROM v_my_tenant THEN
    RAISE EXCEPTION 'performance_competencies_submit: employee belongs to another tenant';
  END IF;

  IF v_role = 'hr'::public.user_role THEN
    NULL;
  ELSIF v_role = 'manager'::public.user_role THEN
    IF v_employee_manager IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'performance_competencies_submit: manager can submit only direct reports';
    END IF;
  ELSE
    RAISE EXCEPTION 'performance_competencies_submit: only hr or manager can submit';
  END IF;

  SELECT COUNT(*)::INT, COALESCE(SUM(item_weight), 0)
    INTO v_assignments_count, v_assigned_total
  FROM public.performance_competency_assignments
  WHERE tenant_id = v_my_tenant
    AND employee_id = p_employee_id;

  IF v_assignments_count > 5 THEN
    RAISE EXCEPTION 'performance_competencies_submit: maximum 5 assigned competencies allowed';
  END IF;
  IF v_assignments_count > 0 AND ABS(v_assigned_total - 1) > 0.0001 THEN
    RAISE EXCEPTION 'performance_competencies_submit: assigned competency weights must sum to 1.0';
  END IF;

  SELECT COUNT(*)::INT
    INTO v_total_competencies
  FROM public.evaluation_competencies;

  SELECT COUNT(*)::INT
    INTO v_rated_competencies
  FROM public.performance_competency_evaluations ev
  WHERE ev.tenant_id = v_my_tenant
    AND ev.employee_id = p_employee_id
    AND ev.rating BETWEEN 1 AND 3
    AND ev.competency_id IN (SELECT id FROM public.evaluation_competencies);

  IF v_rated_competencies <> v_total_competencies THEN
    RAISE EXCEPTION
      'performance_competencies_submit: all competencies from evaluation_competencies must be rated';
  END IF;

  UPDATE public.performance_competency_evaluations ev
  SET submitted_by = auth.uid(),
      submitted_at = NOW()
  WHERE ev.tenant_id = v_my_tenant
    AND ev.employee_id = p_employee_id
    AND ev.competency_id IN (SELECT id FROM public.evaluation_competencies)
    AND ev.rating BETWEEN 1 AND 3;
END;
$$;

ALTER TABLE public.performance_competency_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_competency_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can select performance_competency_assignments in tenant"
  ON public.performance_competency_assignments
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "Managers can select performance_competency_assignments for direct reports"
  ON public.performance_competency_assignments
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "Employees can select own performance_competency_assignments"
  ON public.performance_competency_assignments
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'employee'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND employee_id = auth.uid()
  );

CREATE POLICY "HR can insert performance_competency_assignments"
  ON public.performance_competency_assignments
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.tenant_id = public.get_my_profile_tenant_id()
        AND e.role = 'employee'::public.user_role
    )
  );

CREATE POLICY "Managers can insert performance_competency_assignments for direct reports"
  ON public.performance_competency_assignments
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
        AND e.role = 'employee'::public.user_role
    )
  );

CREATE POLICY "HR can update performance_competency_assignments in tenant"
  ON public.performance_competency_assignments
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "Managers can update performance_competency_assignments for direct reports"
  ON public.performance_competency_assignments
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "HR can delete performance_competency_assignments in tenant"
  ON public.performance_competency_assignments
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "Managers can delete performance_competency_assignments for direct reports"
  ON public.performance_competency_assignments
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "HR can select performance_competency_evaluations in tenant"
  ON public.performance_competency_evaluations
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "Managers can select performance_competency_evaluations for direct reports"
  ON public.performance_competency_evaluations
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "Employees can select own performance_competency_evaluations"
  ON public.performance_competency_evaluations
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'employee'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND employee_id = auth.uid()
  );

CREATE POLICY "HR can insert performance_competency_evaluations in tenant"
  ON public.performance_competency_evaluations
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.tenant_id = public.get_my_profile_tenant_id()
        AND e.role = 'employee'::public.user_role
    )
  );

CREATE POLICY "Managers can insert performance_competency_evaluations for direct reports"
  ON public.performance_competency_evaluations
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
        AND e.role = 'employee'::public.user_role
    )
  );

CREATE POLICY "HR can update performance_competency_evaluations in tenant"
  ON public.performance_competency_evaluations
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "Managers can update performance_competency_evaluations for direct reports"
  ON public.performance_competency_evaluations
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "HR can delete performance_competency_evaluations in tenant"
  ON public.performance_competency_evaluations
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "Managers can delete performance_competency_evaluations for direct reports"
  ON public.performance_competency_evaluations
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_competency_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_competency_evaluations TO authenticated;
GRANT EXECUTE ON FUNCTION public.performance_competencies_submit(UUID) TO authenticated;
