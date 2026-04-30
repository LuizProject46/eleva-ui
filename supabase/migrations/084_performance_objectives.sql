-- Migration 084: Performance objectives (Nine-Box / evaluation foundation, Phase 1)
-- Per employee per evaluation_period: up to 5 objectives, item_weight for future aggregation,
-- manager rating 1–3 + optional comment. RLS: HR tenant-wide, manager direct reports, employee read own.

CREATE TABLE public.performance_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL
    CONSTRAINT performance_objectives_employee_id_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_id UUID NOT NULL
    CONSTRAINT performance_objectives_period_id_fkey REFERENCES public.evaluation_periods(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  item_weight NUMERIC(12, 4) NOT NULL DEFAULT 1
    CONSTRAINT performance_objectives_item_weight_positive CHECK (item_weight > 0),
  rating SMALLINT
    CONSTRAINT performance_objectives_rating_level CHECK (rating IS NULL OR (rating >= 1 AND rating <= 3)),
  manager_comment TEXT,
  rated_by UUID
    CONSTRAINT performance_objectives_rated_by_fkey REFERENCES public.profiles(id) ON DELETE SET NULL,
  rated_at TIMESTAMPTZ,
  created_by UUID
    CONSTRAINT performance_objectives_created_by_fkey REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_performance_objectives_tenant_employee_period
  ON public.performance_objectives (tenant_id, employee_id, period_id);

COMMENT ON TABLE public.performance_objectives IS
  'Manager-scoped objectives per evaluation period. Future calibration may join period_id + employee_id with '
  'competency scores (e.g. component objectives | competencies) into a performance_calibration_components-style aggregate.';

COMMENT ON COLUMN public.performance_objectives.item_weight IS
  'Importance weight for weighted aggregation (distinct from rating scale 1–3).';

COMMENT ON COLUMN public.performance_objectives.rating IS
  'Manager rating: 1 = below expectations, 2 = meets, 3 = exceeds.';

-- BEFORE INSERT: resolve tenant from employee, validate period tenant, cap at 5 rows, default created_by
CREATE OR REPLACE FUNCTION public.performance_objectives_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_tenant UUID;
  v_period_tenant UUID;
  v_count INT;
BEGIN
  SELECT tenant_id INTO v_employee_tenant FROM public.profiles WHERE id = NEW.employee_id LIMIT 1;
  IF v_employee_tenant IS NULL THEN
    RAISE EXCEPTION 'performance_objectives: employee not found or missing tenant';
  END IF;
  NEW.tenant_id := v_employee_tenant;

  SELECT tenant_id INTO v_period_tenant FROM public.evaluation_periods WHERE id = NEW.period_id LIMIT 1;
  IF v_period_tenant IS NULL THEN
    RAISE EXCEPTION 'performance_objectives: period not found';
  END IF;
  IF v_period_tenant IS DISTINCT FROM v_employee_tenant THEN
    RAISE EXCEPTION 'performance_objectives: period must belong to the same tenant as the employee';
  END IF;

  SELECT COUNT(*)::INT INTO v_count
  FROM public.performance_objectives
  WHERE tenant_id = NEW.tenant_id
    AND employee_id = NEW.employee_id
    AND period_id = NEW.period_id;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'performance_objectives: maximum 5 objectives per employee per period';
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER performance_objectives_before_insert
  BEFORE INSERT ON public.performance_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_objectives_before_insert();

-- BEFORE UPDATE: lock identifiers, bump updated_at, sync rated metadata when rating changes
CREATE OR REPLACE FUNCTION public.performance_objectives_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'performance_objectives: employee_id cannot be changed';
  END IF;
  IF NEW.period_id IS DISTINCT FROM OLD.period_id THEN
    RAISE EXCEPTION 'performance_objectives: period_id cannot be changed';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'performance_objectives: tenant_id cannot be changed';
  END IF;

  NEW.updated_at := NOW();

  IF NEW.rating IS NULL THEN
    NEW.rated_by := NULL;
    NEW.rated_at := NULL;
  ELSIF NEW.rating IS DISTINCT FROM OLD.rating THEN
    NEW.rated_by := auth.uid();
    NEW.rated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER performance_objectives_before_update
  BEFORE UPDATE ON public.performance_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_objectives_before_update();

ALTER TABLE public.performance_objectives ENABLE ROW LEVEL SECURITY;

-- SELECT: HR — full tenant
CREATE POLICY "HR can select performance_objectives in tenant"
  ON public.performance_objectives
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- SELECT: Manager — direct reports only
CREATE POLICY "Managers can select performance_objectives for direct reports"
  ON public.performance_objectives
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

-- SELECT: Employee — own rows only
CREATE POLICY "Employees can select own performance_objectives"
  ON public.performance_objectives
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'employee'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND employee_id = auth.uid()
  );

-- INSERT: HR
CREATE POLICY "HR can insert performance_objectives"
  ON public.performance_objectives
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = employee_id
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.evaluation_periods p
      WHERE p.id = period_id
        AND p.tenant_id = public.get_my_profile_tenant_id()
    )
  );

-- INSERT: Manager — direct report only
CREATE POLICY "Managers can insert performance_objectives for direct reports"
  ON public.performance_objectives
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.evaluation_periods p
      WHERE p.id = period_id
        AND p.tenant_id = public.get_my_profile_tenant_id()
    )
  );

-- UPDATE: HR
CREATE POLICY "HR can update performance_objectives in tenant"
  ON public.performance_objectives
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

-- UPDATE: Manager — direct report only
CREATE POLICY "Managers can update performance_objectives for direct reports"
  ON public.performance_objectives
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

-- DELETE: HR
CREATE POLICY "HR can delete performance_objectives in tenant"
  ON public.performance_objectives
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- DELETE: Manager — direct report only
CREATE POLICY "Managers can delete performance_objectives for direct reports"
  ON public.performance_objectives
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_objectives TO authenticated;
