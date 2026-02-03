-- Migration 010: Validação de INSERT em evaluations (quem pode avaliar quem)
-- Run after 001-009

-- 1. Função: valida se (evaluator_id, evaluated_id, type) é permitido pelas regras de papel
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
BEGIN
  IF p_type = 'self' THEN
    IF p_evaluator_id <> p_evaluated_id THEN
      RAISE EXCEPTION 'Autoavaliação exige evaluator_id = evaluated_id';
    END IF;
    RETURN;
  END IF;

  SELECT role::text INTO v_evaluator_role
  FROM public.profiles WHERE id = p_evaluator_id LIMIT 1;
  SELECT role::text INTO v_evaluated_role
  FROM public.profiles WHERE id = p_evaluated_id LIMIT 1;

  IF v_evaluator_role IS NULL OR v_evaluated_role IS NULL THEN
    RAISE EXCEPTION 'Avaliador ou avaliado não encontrado';
  END IF;

  -- Gestor pode avaliar: colaboradores (employee), RH (hr)
  IF v_evaluator_role = 'manager' THEN
    IF p_type IN ('manager_to_employee', 'direct_feedback') AND v_evaluated_role IN ('employee', 'hr') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Gestor só pode avaliar colaboradores e RH';
  END IF;

  -- Colaborador pode avaliar: gestor (manager), RH (hr)
  IF v_evaluator_role = 'employee' THEN
    IF p_type IN ('employee_to_manager', 'direct_feedback') AND v_evaluated_role IN ('manager', 'hr') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Colaborador só pode avaliar gestor e RH';
  END IF;

  -- RH pode avaliar: todos (employee, manager, hr)
  IF v_evaluator_role = 'hr' THEN
    IF p_type IN ('hr_to_user', 'direct_feedback') AND v_evaluated_role IN ('employee', 'manager', 'hr') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'RH pode avaliar qualquer usuário do tenant';
  END IF;

  RAISE EXCEPTION 'Combinação avaliador/avaliado/tipo não permitida';
END;
$$;

-- 2. Trigger: antes de INSERT em evaluations
CREATE OR REPLACE FUNCTION public.trg_validate_evaluation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.validate_evaluation_allowed(NEW.evaluator_id, NEW.evaluated_id, NEW.type);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_evaluation_insert ON evaluations;
CREATE TRIGGER validate_evaluation_insert
  BEFORE INSERT ON evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_evaluation_insert();

-- 3. RLS profiles: colaborador pode ver RH do mesmo tenant (para dropdown "avaliado")
CREATE POLICY "Users can view HR of same tenant" ON profiles
  FOR SELECT
  USING (
    role = 'hr'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
  );
