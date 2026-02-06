-- Migration 018: HR can view all tenant users (profiles) and evaluate anyone in the tenant.
-- Employees and managers remain restricted to same sector or team.

-- 1. RLS: HR can see all profiles in their tenant.
CREATE POLICY "HR can view all tenant profiles" ON profiles
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- 2. Evaluation validation: HR is exempt from sector/team check (can evaluate anyone in tenant).
CREATE OR REPLACE FUNCTION public.validate_evaluation_allowed(
  p_evaluator_id UUID,
  p_evaluated_id UUID,
  p_type public.evaluation_type
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluator_role text;
  v_evaluated_role text;
  v_eval_department text;
  v_eval_manager_id uuid;
  v_evaluated_department text;
  v_evaluated_manager_id uuid;
BEGIN
  IF p_type = 'self' THEN
    IF p_evaluator_id <> p_evaluated_id THEN
      RAISE EXCEPTION 'Autoavaliação exige evaluator_id = evaluated_id';
    END IF;
    RETURN;
  END IF;

  IF p_evaluator_id = p_evaluated_id THEN
    RAISE EXCEPTION 'Não é permitido avaliar a si mesmo neste tipo de avaliação';
  END IF;

  SELECT role::text, department, manager_id INTO v_evaluator_role, v_eval_department, v_eval_manager_id
  FROM public.profiles WHERE id = p_evaluator_id LIMIT 1;
  SELECT role::text, department, manager_id INTO v_evaluated_role, v_evaluated_department, v_evaluated_manager_id
  FROM public.profiles WHERE id = p_evaluated_id LIMIT 1;

  IF v_evaluator_role IS NULL OR v_evaluated_role IS NULL THEN
    RAISE EXCEPTION 'Avaliador ou avaliado não encontrado';
  END IF;

  -- Same sector or team: applies to employee and manager only. HR can evaluate anyone in the tenant.
  IF v_evaluator_role <> 'hr' THEN
    IF NOT (
      (v_eval_department IS NOT DISTINCT FROM v_evaluated_department)
      OR (v_eval_manager_id IS NOT DISTINCT FROM v_evaluated_manager_id)
    ) THEN
      RAISE EXCEPTION 'Avaliador e avaliado devem pertencer ao mesmo setor ou à mesma equipe';
    END IF;
  END IF;

  IF v_evaluator_role = 'manager' THEN
    IF p_type IN ('manager_to_employee', 'direct_feedback') AND v_evaluated_role IN ('employee', 'hr') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Gestor só pode avaliar colaboradores e RH';
  END IF;

  IF v_evaluator_role = 'employee' THEN
    IF p_type IN ('employee_to_manager', 'employee_to_employee', 'direct_feedback')
       AND v_evaluated_role IN ('manager', 'hr', 'employee') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Colaborador só pode avaliar gestor, RH ou outros colaboradores';
  END IF;

  IF v_evaluator_role = 'hr' THEN
    IF p_type IN ('hr_to_user', 'direct_feedback') AND v_evaluated_role IN ('employee', 'manager', 'hr') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'RH pode avaliar qualquer usuário do tenant';
  END IF;

  RAISE EXCEPTION 'Combinação avaliador/avaliado/tipo não permitida';
END;
$$;

COMMENT ON FUNCTION public.validate_evaluation_allowed(uuid, uuid, public.evaluation_type) IS
  'Validates evaluation insert/update: no self-evaluation for non-self types; employee and manager must have same sector/team as evaluated; HR can see and evaluate all tenant users.';
