-- Migration 072: PDI RBAC — only managers may write pdis, pdi_action_plans, pdi_plan_actions
-- (direct reports + same tenant). HR and employees: SELECT only on visible rows.

CREATE OR REPLACE FUNCTION public.pdi_manager_can_write(p_pdi_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pdis p
    JOIN public.profiles e ON e.id = p.employee_id
    JOIN public.profiles me ON me.id = auth.uid()
    WHERE p.id = p_pdi_id
      AND me.role::text = 'manager'
      AND p.tenant_id IS NOT NULL
      AND p.tenant_id = me.tenant_id
      AND e.manager_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.pdi_manager_can_write(uuid) IS
  'True if auth.uid() is a manager who directly manages the PDI employee, same tenant. Used by PDI write RLS.';

-- ===== pdis =====
DROP POLICY IF EXISTS "PDI: insert manager/hr" ON public.pdis;
DROP POLICY IF EXISTS "PDI: update creator/manager/hr" ON public.pdis;
DROP POLICY IF EXISTS "PDI: delete hr only" ON public.pdis;

CREATE POLICY "PDI: insert manager direct report" ON public.pdis
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = public.pdis.employee_id
        AND e.manager_id = auth.uid()
        AND e.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "PDI: update manager direct report" ON public.pdis
  FOR UPDATE
  USING (public.pdi_manager_can_write(public.pdis.id))
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND public.pdi_manager_can_write(public.pdis.id)
  );

CREATE POLICY "PDI: delete manager direct report" ON public.pdis
  FOR DELETE
  USING (public.pdi_manager_can_write(public.pdis.id));

-- ===== pdi_action_plans =====
DROP POLICY IF EXISTS "PDI action plans: insert creator/manager/hr" ON public.pdi_action_plans;
DROP POLICY IF EXISTS "PDI action plans: update creator/manager/hr" ON public.pdi_action_plans;
DROP POLICY IF EXISTS "PDI action plans: delete hr only" ON public.pdi_action_plans;

CREATE POLICY "PDI action plans: insert manager" ON public.pdi_action_plans
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.pdi_manager_can_write(public.pdi_action_plans.pdi_id)
  );

CREATE POLICY "PDI action plans: update manager" ON public.pdi_action_plans
  FOR UPDATE
  USING (public.pdi_manager_can_write(public.pdi_action_plans.pdi_id))
  WITH CHECK (public.pdi_manager_can_write(public.pdi_action_plans.pdi_id));

CREATE POLICY "PDI action plans: delete manager" ON public.pdi_action_plans
  FOR DELETE
  USING (public.pdi_manager_can_write(public.pdi_action_plans.pdi_id));

-- ===== pdi_plan_actions =====
DROP POLICY IF EXISTS "PDI plan actions: insert visible" ON public.pdi_plan_actions;
DROP POLICY IF EXISTS "PDI plan actions: update visible" ON public.pdi_plan_actions;
DROP POLICY IF EXISTS "PDI plan actions: delete visible" ON public.pdi_plan_actions;

CREATE POLICY "PDI plan actions: insert manager" ON public.pdi_plan_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
        AND public.pdi_manager_can_write(ap.pdi_id)
    )
  );

CREATE POLICY "PDI plan actions: update manager" ON public.pdi_plan_actions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
        AND public.pdi_manager_can_write(ap.pdi_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
        AND public.pdi_manager_can_write(ap.pdi_id)
    )
  );

CREATE POLICY "PDI plan actions: delete manager" ON public.pdi_plan_actions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
        AND public.pdi_manager_can_write(ap.pdi_id)
    )
  );
