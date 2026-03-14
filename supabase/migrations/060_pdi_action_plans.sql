-- Migration 060: PDI Action Plans (replaces competency/gap model)
-- Creates pdi_action_plans and pdi_plan_actions for the checklist-based action plan model.

-- 1) Allowed action plan types (must match src/constants/actionPlanTypes.ts)
CREATE TYPE public.pdi_action_plan_type AS ENUM (
  'technical_development',
  'soft_skills',
  'training',
  'certification',
  'mentorship',
  'practical_project'
);

-- 2) pdi_action_plans
CREATE TABLE IF NOT EXISTS public.pdi_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id UUID NOT NULL REFERENCES public.pdis(id) ON DELETE CASCADE,
  type public.pdi_action_plan_type NOT NULL,
  delivery_date DATE,
  description TEXT,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdi_action_plans_pdi_id ON public.pdi_action_plans(pdi_id);
CREATE INDEX IF NOT EXISTS idx_pdi_action_plans_position ON public.pdi_action_plans(pdi_id, position);

COMMENT ON TABLE public.pdi_action_plans IS 'PDI Action Plans: type, delivery date, description. Replaces pdi_gaps.';

ALTER TABLE public.pdi_action_plans ENABLE ROW LEVEL SECURITY;

-- RLS: same visibility as pdi_gaps
CREATE POLICY "PDI action plans: select visible" ON public.pdi_action_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_action_plans.pdi_id
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

CREATE POLICY "PDI action plans: insert creator/manager/hr" ON public.pdi_action_plans
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_action_plans.pdi_id
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

CREATE POLICY "PDI action plans: update creator/manager/hr" ON public.pdi_action_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_action_plans.pdi_id
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
      WHERE p.id = public.pdi_action_plans.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "PDI action plans: delete hr only" ON public.pdi_action_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_action_plans.pdi_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
    )
  );

-- 3) pdi_plan_actions (checklist tasks)
CREATE TABLE IF NOT EXISTS public.pdi_plan_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_action_plan_id UUID NOT NULL REFERENCES public.pdi_action_plans(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdi_plan_actions_plan_id ON public.pdi_plan_actions(pdi_action_plan_id);

COMMENT ON TABLE public.pdi_plan_actions IS 'Checklist actions within a PDI Action Plan.';

ALTER TABLE public.pdi_plan_actions ENABLE ROW LEVEL SECURITY;

-- Select: same as action plan visibility
CREATE POLICY "PDI plan actions: select visible" ON public.pdi_plan_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      JOIN public.pdis p ON p.id = ap.pdi_id
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
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

-- Insert: creator/manager/hr (same as action plans)
CREATE POLICY "PDI plan actions: insert visible" ON public.pdi_plan_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      JOIN public.pdis p ON p.id = ap.pdi_id
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
          OR ap.created_by = auth.uid()
        )
    )
  );

-- Update: allow employee to toggle completed; manager/hr can edit any field
CREATE POLICY "PDI plan actions: update visible" ON public.pdi_plan_actions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      JOIN public.pdis p ON p.id = ap.pdi_id
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      JOIN public.pdis p ON p.id = ap.pdi_id
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Delete: creator/manager/hr
CREATE POLICY "PDI plan actions: delete visible" ON public.pdi_plan_actions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pdi_action_plans ap
      JOIN public.pdis p ON p.id = ap.pdi_id
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE ap.id = public.pdi_plan_actions.pdi_action_plan_id
        AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'hr'
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
          OR ap.created_by = auth.uid()
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_action_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_plan_actions TO authenticated;

-- 4) Backfill from pdi_gaps and pdi_actions (if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pdi_gaps') THEN
    INSERT INTO public.pdi_action_plans (id, pdi_id, type, delivery_date, description, position, created_by, created_at, updated_at)
    SELECT id, pdi_id, 'practical_project'::public.pdi_action_plan_type, due_date, title, position, created_by, created_at, updated_at
    FROM public.pdi_gaps
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pdi_actions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pdi_actions' AND column_name = 'pdi_gap_id') THEN
    INSERT INTO public.pdi_plan_actions (pdi_action_plan_id, description, completed, position, created_at, updated_at)
    SELECT pdi_gap_id, description, (status = 'completed'), 0, created_at, updated_at
    FROM public.pdi_actions
    WHERE pdi_gap_id IS NOT NULL;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $$;
