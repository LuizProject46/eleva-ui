-- Migration 019: Add evaluation type employee_to_hr (colaborador → RH).
-- Run after 018.

ALTER TYPE evaluation_type ADD VALUE IF NOT EXISTS 'employee_to_hr';

-- Allow employee → hr for type employee_to_hr in validate_evaluation_allowed.
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
    IF p_type = 'employee_to_hr' AND v_evaluated_role = 'hr' THEN RETURN; END IF;
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
