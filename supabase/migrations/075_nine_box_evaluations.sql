-- Migration 075: Nine-box talent matrix evaluations (multi-tenant, HR + manager scoped)

CREATE TYPE public.nine_box_axis_level AS ENUM ('low', 'medium', 'high');

CREATE TABLE public.nine_box_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL
    CONSTRAINT nine_box_evaluations_employee_id_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
  performance public.nine_box_axis_level NOT NULL,
  potential public.nine_box_axis_level NOT NULL,
  notes TEXT,
  evaluated_by UUID NOT NULL DEFAULT auth.uid()
    CONSTRAINT nine_box_evaluations_evaluated_by_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nine_box_evaluations_tenant_employee_unique UNIQUE (tenant_id, employee_id)
);

CREATE INDEX idx_nine_box_evaluations_tenant_evaluated_by
  ON public.nine_box_evaluations(tenant_id, evaluated_by);

-- Always set tenant_id from evaluator profile (ignore client-supplied value)
CREATE OR REPLACE FUNCTION public.nine_box_evaluations_set_tenant_from_evaluator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'nine_box_evaluations: cannot resolve tenant for current user';
  END IF;
  NEW.tenant_id := v_tenant;
  RETURN NEW;
END;
$$;

CREATE TRIGGER nine_box_evaluations_set_tenant_before_insert
  BEFORE INSERT ON public.nine_box_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.nine_box_evaluations_set_tenant_from_evaluator();

-- Lock identifiers; bump updated_at on every update
CREATE OR REPLACE FUNCTION public.nine_box_evaluations_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'nine_box_evaluations: employee_id cannot be changed';
  END IF;
  IF NEW.evaluated_by IS DISTINCT FROM OLD.evaluated_by THEN
    RAISE EXCEPTION 'nine_box_evaluations: evaluated_by cannot be changed';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'nine_box_evaluations: tenant_id cannot be changed';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER nine_box_evaluations_before_update
  BEFORE UPDATE ON public.nine_box_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.nine_box_evaluations_before_update();

ALTER TABLE public.nine_box_evaluations ENABLE ROW LEVEL SECURITY;

-- SELECT: HR — full tenant
CREATE POLICY "HR can select nine box evaluations in tenant"
  ON public.nine_box_evaluations
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- SELECT: Manager — direct reports only
CREATE POLICY "Managers can select nine box evaluations for direct reports"
  ON public.nine_box_evaluations
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

-- INSERT: HR
CREATE POLICY "HR can insert nine box evaluations"
  ON public.nine_box_evaluations
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND evaluated_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  );

-- INSERT: Manager — target must be direct report
CREATE POLICY "Managers can insert nine box evaluations for direct reports"
  ON public.nine_box_evaluations
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND evaluated_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles e
      WHERE e.id = employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = public.get_my_profile_tenant_id()
    )
  );

-- UPDATE: HR
CREATE POLICY "HR can update nine box evaluations in tenant"
  ON public.nine_box_evaluations
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

-- UPDATE: Manager — direct report only
CREATE POLICY "Managers can update nine box evaluations for direct reports"
  ON public.nine_box_evaluations
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

GRANT SELECT, INSERT, UPDATE ON public.nine_box_evaluations TO authenticated;
