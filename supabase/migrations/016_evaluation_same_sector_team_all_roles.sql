-- Migration 016: Evaluation permissions — same sector/team for all roles (employee, manager, HR).
-- Central rule: any user can only see and evaluate people in the same sector or team.
-- Sector = department; team = same manager_id. Enforced in RLS and in validate_evaluation_allowed.

-- 1. Helper: current user's department (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_profile_department()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. RLS on profiles: replace role-specific SELECT policies with a single rule for all roles.
-- Drop policies that allowed HR "all tenant", managers "team" / "managers+HR", "own manager", "HR same tenant".
DROP POLICY IF EXISTS "HR can view all tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view team profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view tenant managers and HR" ON profiles;
DROP POLICY IF EXISTS "Users can view own manager" ON profiles;
DROP POLICY IF EXISTS "Users can view HR of same tenant" ON profiles;

-- Single visibility rule: authenticated users see same tenant + (same sector OR same team), excluding self.
-- "Users can view own profile" remains (everyone always sees their own row).
CREATE POLICY "Authenticated users can view same sector or team" ON profiles
  FOR SELECT
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
    AND id <> auth.uid()
    AND (
      department IS NOT DISTINCT FROM public.get_my_profile_department()
      OR manager_id = public.get_my_manager_id()
    )
  );

-- 3. Evaluation validation: same sector/team for all roles, no self-evaluation, allow employee→employee for direct_feedback.
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
  -- Self-evaluation: only allowed when type is 'self'.
  IF p_type = 'self' THEN
    IF p_evaluator_id <> p_evaluated_id THEN
      RAISE EXCEPTION 'Autoavaliação exige evaluator_id = evaluated_id';
    END IF;
    RETURN;
  END IF;

  -- No self-evaluation for non-self types.
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

  -- Same sector or team: applies to all roles (employee, manager, HR).
  IF NOT (
    (v_eval_department IS NOT DISTINCT FROM v_evaluated_department)
    OR (v_eval_manager_id IS NOT DISTINCT FROM v_evaluated_manager_id)
  ) THEN
    RAISE EXCEPTION 'Avaliador e avaliado devem pertencer ao mesmo setor ou à mesma equipe';
  END IF;

  -- Role/type rules: who can evaluate whom by evaluation type.
  IF v_evaluator_role = 'manager' THEN
    IF p_type IN ('manager_to_employee', 'direct_feedback') AND v_evaluated_role IN ('employee', 'hr') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Gestor só pode avaliar colaboradores e RH';
  END IF;

  -- Colaborador pode avaliar: gestor (manager), RH (hr), e outros colaboradores (employee) em direct_feedback.
  IF v_evaluator_role = 'employee' THEN
    IF p_type IN ('employee_to_manager', 'direct_feedback') AND v_evaluated_role IN ('manager', 'hr', 'employee') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Colaborador só pode avaliar gestor, RH ou outros colaboradores (feedback direto)';
  END IF;

  IF v_evaluator_role = 'hr' THEN
    IF p_type IN ('hr_to_user', 'direct_feedback') AND v_evaluated_role IN ('employee', 'manager', 'hr') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'RH pode avaliar qualquer usuário do tenant (mesmo setor ou equipe)';
  END IF;

  RAISE EXCEPTION 'Combinação avaliador/avaliado/tipo não permitida';
END;
$$;

-- Trigger already exists; ensure it runs (no change needed for INSERT).
-- If evaluation UPDATE is added later, add BEFORE UPDATE trigger calling the same function.

COMMENT ON FUNCTION public.validate_evaluation_allowed(uuid, uuid, public.evaluation_type) IS
  'Validates evaluation insert/update: no self-evaluation for non-self types; evaluator and evaluated must belong to same sector (department) or same team (manager_id). Applies to all roles.';
