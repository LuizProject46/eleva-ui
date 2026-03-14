-- Migration 056: PDI v2 simplified RLS
-- Principles:
-- - Explicit tenant isolation (no reliance on SECURITY DEFINER helper functions inside PDI policies)
-- - Simple role checks (employee/manager/hr)
-- - Updates: creator OR manager (plus HR)
-- - Deletes: HR only

-- Helpers (inline expressions used repeatedly)
-- userTenantId := (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
-- userRole     := (SELECT role::text FROM public.profiles WHERE id = auth.uid())

-- ===== pdis =====
DROP POLICY IF EXISTS "Employees can view own PDIs" ON public.pdis;
DROP POLICY IF EXISTS "Managers can view direct report PDIs" ON public.pdis;
DROP POLICY IF EXISTS "HR can view all tenant PDIs" ON public.pdis;
DROP POLICY IF EXISTS "Managers can insert PDIs for direct reports" ON public.pdis;
DROP POLICY IF EXISTS "HR can insert PDIs for tenant" ON public.pdis;
DROP POLICY IF EXISTS "Managers can update direct report PDIs" ON public.pdis;
DROP POLICY IF EXISTS "HR can update tenant PDIs" ON public.pdis;
DROP POLICY IF EXISTS "Managers can delete direct report PDIs" ON public.pdis;
DROP POLICY IF EXISTS "HR can delete tenant PDIs" ON public.pdis;

CREATE POLICY "PDI: select visible" ON public.pdis
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (
      employee_id = auth.uid()
      OR (
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
        AND EXISTS (
          SELECT 1 FROM public.profiles e
          WHERE e.id = public.pdis.employee_id
            AND e.manager_id = auth.uid()
        )
      )
      OR (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
    )
  );

CREATE POLICY "PDI: insert manager/hr" ON public.pdis
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (
      (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
      OR (
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
        AND EXISTS (
          SELECT 1 FROM public.profiles e
          WHERE e.id = public.pdis.employee_id
            AND e.manager_id = auth.uid()
            AND e.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "PDI: update creator/manager/hr" ON public.pdis
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (
      (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
      OR created_by = auth.uid()
      OR (
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
        AND EXISTS (
          SELECT 1 FROM public.profiles e
          WHERE e.id = public.pdis.employee_id
            AND e.manager_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "PDI: delete hr only" ON public.pdis
  FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
  );

-- ===== competencies (tenant-scoped) =====
DROP POLICY IF EXISTS "Competencies: select tenant" ON public.competencies;
DROP POLICY IF EXISTS "Competencies: insert hr" ON public.competencies;
DROP POLICY IF EXISTS "Competencies: update hr" ON public.competencies;
DROP POLICY IF EXISTS "Competencies: delete hr" ON public.competencies;

CREATE POLICY "Competencies: select tenant" ON public.competencies
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Competencies: insert hr" ON public.competencies
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
  );

CREATE POLICY "Competencies: update hr" ON public.competencies
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Competencies: delete hr" ON public.competencies
  FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
  );

-- ===== pdi_gaps =====
DROP POLICY IF EXISTS "PDI gaps: select visible" ON public.pdi_gaps;
DROP POLICY IF EXISTS "PDI gaps: insert creator/manager/hr" ON public.pdi_gaps;
DROP POLICY IF EXISTS "PDI gaps: update creator/manager/hr" ON public.pdi_gaps;
DROP POLICY IF EXISTS "PDI gaps: delete hr only" ON public.pdi_gaps;

CREATE POLICY "PDI gaps: select visible" ON public.pdi_gaps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_gaps.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          p.employee_id = auth.uid()
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
          OR (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
        )
    )
  );

CREATE POLICY "PDI gaps: insert creator/manager/hr" ON public.pdi_gaps
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_gaps.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
          OR p.created_by = auth.uid()
        )
    )
  );

CREATE POLICY "PDI gaps: update creator/manager/hr" ON public.pdi_gaps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_gaps.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
          OR created_by = auth.uid()
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_gaps.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "PDI gaps: delete hr only" ON public.pdi_gaps
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_gaps.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
    )
  );

-- ===== pdi_actions =====
DROP POLICY IF EXISTS "View actions of visible PDIs" ON public.pdi_actions;
DROP POLICY IF EXISTS "Managers can manage actions of direct report PDIs" ON public.pdi_actions;
DROP POLICY IF EXISTS "HR can manage actions of tenant PDIs" ON public.pdi_actions;
DROP POLICY IF EXISTS "Employees can update own assigned action status" ON public.pdi_actions;
DROP POLICY IF EXISTS "Employees can update own practice action progress" ON public.pdi_actions;

-- SELECT (v2 via gaps)
CREATE POLICY "PDI actions: select via gaps" ON public.pdi_actions
  FOR SELECT
  USING (
    public.pdi_actions.pdi_gap_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pdi_gaps g
      JOIN public.pdis p ON p.id = g.pdi_id
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE g.id = public.pdi_actions.pdi_gap_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          p.employee_id = auth.uid()
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
          OR (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
        )
    )
  );

-- SELECT (legacy via objectives, kept for safe cutover)
CREATE POLICY "PDI actions: select via objectives (legacy)" ON public.pdi_actions
  FOR SELECT
  USING (
    public.pdi_actions.pdi_objective_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pdi_objectives o
      JOIN public.pdis p ON p.id = o.pdi_id
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE o.id = public.pdi_actions.pdi_objective_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          p.employee_id = auth.uid()
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
          OR (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
        )
    )
  );

-- INSERT (v2, via gaps). Require created_by = auth.uid(); allow manager/hr/creator.
CREATE POLICY "PDI actions: insert via gaps" ON public.pdi_actions
  FOR INSERT
  WITH CHECK (
    public.pdi_actions.pdi_gap_id IS NOT NULL
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pdi_gaps g
      JOIN public.pdis p ON p.id = g.pdi_id
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE g.id = public.pdi_actions.pdi_gap_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
          OR p.created_by = auth.uid()
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles r
      WHERE r.id = public.pdi_actions.responsible_user_id
        AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- UPDATE (v2 or legacy). Allow creator/manager/hr.
CREATE POLICY "PDI actions: update creator/manager/hr" ON public.pdi_actions
  FOR UPDATE
  USING (
    (
      created_by = auth.uid()
      OR (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
      OR (
        (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
        AND (
          EXISTS (
            SELECT 1
            FROM public.pdi_gaps g
            JOIN public.pdis p ON p.id = g.pdi_id
            JOIN public.profiles e ON e.id = p.employee_id
            WHERE g.id = public.pdi_actions.pdi_gap_id
              AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
              AND e.manager_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.pdi_objectives o
            JOIN public.pdis p ON p.id = o.pdi_id
            JOIN public.profiles e ON e.id = p.employee_id
            WHERE o.id = public.pdi_actions.pdi_objective_id
              AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
              AND e.manager_id = auth.uid()
          )
        )
      )
    )
  )
  WITH CHECK (
    -- enforce tenant isolation on writes (via either parent path)
    (
      public.pdi_actions.pdi_gap_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.pdi_gaps g
        JOIN public.pdis p ON p.id = g.pdi_id
        WHERE g.id = public.pdi_actions.pdi_gap_id
          AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
    )
    OR (
      public.pdi_actions.pdi_objective_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.pdi_objectives o
        JOIN public.pdis p ON p.id = o.pdi_id
        WHERE o.id = public.pdi_actions.pdi_objective_id
          AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- DELETE: HR only (tenant)
CREATE POLICY "PDI actions: delete hr only" ON public.pdi_actions
  FOR DELETE
  USING (
    (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
    AND (
      (
        public.pdi_actions.pdi_gap_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.pdi_gaps g
          JOIN public.pdis p ON p.id = g.pdi_id
          WHERE g.id = public.pdi_actions.pdi_gap_id
            AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
      )
      OR (
        public.pdi_actions.pdi_objective_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.pdi_objectives o
          JOIN public.pdis p ON p.id = o.pdi_id
          WHERE o.id = public.pdi_actions.pdi_objective_id
            AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
      )
    )
  );

-- ===== pdi_checkins =====
-- Keep the existing behavior (active-only insert; employee can update own PDI checkins for employee_comment)
-- but rewrite policies to remove dependency on helper functions.

DROP POLICY IF EXISTS "View checkins of visible PDIs" ON public.pdi_checkins;
DROP POLICY IF EXISTS "Employees can insert checkins on own active PDI" ON public.pdi_checkins;
DROP POLICY IF EXISTS "Managers can insert checkins on direct report active PDIs" ON public.pdi_checkins;
DROP POLICY IF EXISTS "HR can insert checkins on tenant active PDIs" ON public.pdi_checkins;
DROP POLICY IF EXISTS "Managers can update checkins of direct report PDIs" ON public.pdi_checkins;
DROP POLICY IF EXISTS "HR can update checkins of tenant PDIs" ON public.pdi_checkins;
DROP POLICY IF EXISTS "Employees can update checkins of own PDI" ON public.pdi_checkins;

CREATE POLICY "PDI checkins: select visible" ON public.pdi_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          p.employee_id = auth.uid()
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
          OR (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
        )
    )
  );

-- INSERT: active-only; manager/hr; employee can insert on own active PDI (kept)
CREATE POLICY "PDI checkins: insert employee own active" ON public.pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND p.employee_id = auth.uid()
        AND p.status = 'active'
    )
  );

CREATE POLICY "PDI checkins: insert manager direct report active" ON public.pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND e.manager_id = auth.uid()
        AND p.status = 'active'
    )
  );

CREATE POLICY "PDI checkins: insert hr active" ON public.pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND p.status = 'active'
    )
  );

-- UPDATE: manager/hr on PDIs they manage; employee on own PDI (for employee_comment)
CREATE POLICY "PDI checkins: update manager direct report" ON public.pdi_checkins
  FOR UPDATE
  USING (
    (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND e.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND e.manager_id = auth.uid()
    )
  );

CREATE POLICY "PDI checkins: update hr tenant" ON public.pdi_checkins
  FOR UPDATE
  USING (
    (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "PDI checkins: update employee own pdi" ON public.pdi_checkins
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND p.employee_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_checkins.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND p.employee_id = auth.uid()
    )
  );

