-- Migration 085: Remove period_id from performance_objectives; cap at 5 per employee;
-- assignee must be role employee; INSERT policies no longer reference evaluation_periods.
--
-- Data rule: before structural changes, keep at most 5 rows per (tenant_id, employee_id),
-- preferring the most recently updated rows (then created_at).
--
-- Order: policies and trigger functions must not reference period_id before DROP COLUMN
-- (PostgreSQL blocks dropping columns depended on by policies).

DELETE FROM public.performance_objectives po
WHERE po.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, employee_id
        ORDER BY updated_at DESC, created_at DESC
      ) AS rn
    FROM public.performance_objectives
  ) ranked
  WHERE rn > 5
);

-- BEFORE INSERT: resolve tenant from employee, cap at 5 rows per employee, default created_by
CREATE OR REPLACE FUNCTION public.performance_objectives_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_tenant UUID;
  v_count INT;
BEGIN
  SELECT tenant_id INTO v_employee_tenant FROM public.profiles WHERE id = NEW.employee_id LIMIT 1;
  IF v_employee_tenant IS NULL THEN
    RAISE EXCEPTION 'performance_objectives: employee not found or missing tenant';
  END IF;
  NEW.tenant_id := v_employee_tenant;

  SELECT COUNT(*)::INT INTO v_count
  FROM public.performance_objectives
  WHERE tenant_id = NEW.tenant_id
    AND employee_id = NEW.employee_id;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'performance_objectives: maximum 5 objectives per employee';
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

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

DROP POLICY IF EXISTS "HR can insert performance_objectives" ON public.performance_objectives;
DROP POLICY IF EXISTS "Managers can insert performance_objectives for direct reports" ON public.performance_objectives;

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
        AND e.role = 'employee'::public.user_role
    )
  );

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
        AND e.role = 'employee'::public.user_role
    )
  );

ALTER TABLE public.performance_objectives
  DROP CONSTRAINT IF EXISTS performance_objectives_period_id_fkey;

DROP INDEX IF EXISTS public.idx_performance_objectives_tenant_employee_period;

ALTER TABLE public.performance_objectives
  DROP COLUMN IF EXISTS period_id;

CREATE INDEX idx_performance_objectives_tenant_employee
  ON public.performance_objectives (tenant_id, employee_id);

COMMENT ON TABLE public.performance_objectives IS
  'Manager-scoped objectives per collaborator (max 5 per employee). Weighted aggregation may join '
  'employee_id with competency scores into calibration-style aggregates.';
