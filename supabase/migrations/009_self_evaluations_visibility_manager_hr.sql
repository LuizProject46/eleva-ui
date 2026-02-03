-- Migration 009: Gestor e RH podem ver autoavaliações (equipe / tenant)
-- Run after 007, 008

-- 1. Gestor: SELECT em evaluations onde type = 'self' e evaluated_id é da equipe
CREATE POLICY "Managers can view team self-evaluations" ON evaluations
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND type = 'self'
    AND evaluated_id IN (
      SELECT id FROM public.profiles
      WHERE manager_id = auth.uid()
      AND tenant_id = public.get_my_profile_tenant_id()
    )
  );

-- 2. RH: SELECT em evaluations onde type = 'self' e mesmo tenant
CREATE POLICY "HR can view all tenant self-evaluations" ON evaluations
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND type = 'self'
  );

-- 3. evaluation_scores: estender política para incluir scores das autoavaliações visíveis a gestor/RH
DROP POLICY IF EXISTS "Users see scores of visible evaluations" ON evaluation_scores;

CREATE POLICY "Users see scores of visible evaluations" ON evaluation_scores
  FOR ALL USING (
    evaluation_id IN (
      SELECT id FROM evaluations
      WHERE tenant_id = public.get_my_profile_tenant_id()
      AND (
        evaluator_id = auth.uid()
        OR evaluated_id = auth.uid()
        OR (
          type = 'self'
          AND (
            (public.get_my_profile_role() = 'manager' AND evaluated_id IN (
              SELECT id FROM public.profiles
              WHERE manager_id = auth.uid()
              AND tenant_id = public.get_my_profile_tenant_id()
            ))
            OR (public.get_my_profile_role() = 'hr')
          )
        )
      )
    )
  );
