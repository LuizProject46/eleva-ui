-- Migration 045: PDI (Plano de Desenvolvimento Individual) module
-- Tables: pdis, pdi_objectives, pdi_actions, pdi_checkins
-- RLS: Employee (own), Manager (direct reports), HR (tenant)

-- pdis: one per employee per period; links to evaluation and/or DISC optional
CREATE TABLE pdis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('evaluation', 'disc', 'feedback')),
  evaluation_id UUID REFERENCES evaluations(id) ON DELETE SET NULL,
  behavioral_assessment_id UUID REFERENCES behavioral_assessments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_approval', 'active', 'closed')),
  closed_at TIMESTAMPTZ,
  result TEXT CHECK (result IS NULL OR result IN ('completed', 'partial', 'not_completed')),
  close_comment TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pdis_employee_id ON pdis(employee_id);
CREATE INDEX idx_pdis_tenant_id ON pdis(tenant_id);
CREATE INDEX idx_pdis_status ON pdis(status);
CREATE INDEX idx_pdis_start_date ON pdis(start_date);
CREATE INDEX idx_pdis_end_date ON pdis(end_date);
CREATE INDEX idx_pdis_tenant_status ON pdis(tenant_id, status);

COMMENT ON TABLE pdis IS 'Individual development plans; status: draft -> in_approval -> active -> closed';

ALTER TABLE pdis ENABLE ROW LEVEL SECURITY;

-- SELECT: Employee own; Manager direct reports; HR all tenant
CREATE POLICY "Employees can view own PDIs" ON pdis
  FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Managers can view direct report PDIs" ON pdis
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = pdis.employee_id AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "HR can view all tenant PDIs" ON pdis
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- INSERT: Manager for direct reports; HR for any tenant profile
CREATE POLICY "Managers can insert PDIs for direct reports" ON pdis
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = pdis.employee_id AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "HR can insert PDIs for tenant" ON pdis
  FOR INSERT
  WITH CHECK (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- UPDATE: same visibility as insert for draft/in_approval; HR for status to active; Manager/HR for close
CREATE POLICY "Managers can update direct report PDIs" ON pdis
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = pdis.employee_id AND p.manager_id = auth.uid()
    )
  )
  WITH CHECK (tenant_id = public.get_my_profile_tenant_id());

CREATE POLICY "HR can update tenant PDIs" ON pdis
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  )
  WITH CHECK (tenant_id = public.get_my_profile_tenant_id());

-- DELETE: Manager direct reports; HR tenant
CREATE POLICY "Managers can delete direct report PDIs" ON pdis
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = pdis.employee_id AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "HR can delete tenant PDIs" ON pdis
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION public.set_pdis_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pdis_updated_at
  BEFORE UPDATE ON pdis
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pdis_updated_at();

-- pdi_objectives
CREATE TABLE pdi_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id UUID NOT NULL REFERENCES pdis(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  competency TEXT,
  priority TEXT CHECK (priority IS NULL OR priority IN ('high', 'medium', 'low')),
  due_date DATE,
  position INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_pdi_objectives_pdi_id ON pdi_objectives(pdi_id);

ALTER TABLE pdi_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View objectives of visible PDIs" ON pdi_objectives
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pdis
      WHERE pdis.id = pdi_objectives.pdi_id
      AND (
        pdis.employee_id = auth.uid()
        OR (
          public.get_my_profile_role() = 'manager'
          AND pdis.tenant_id = public.get_my_profile_tenant_id()
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pdis.employee_id AND p.manager_id = auth.uid())
        )
        OR (
          public.get_my_profile_role() = 'hr'
          AND pdis.tenant_id = public.get_my_profile_tenant_id()
        )
      )
    )
  );

CREATE POLICY "Managers can manage objectives of direct report PDIs" ON pdi_objectives
  FOR ALL
  USING (
    public.get_my_profile_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM pdis
      JOIN public.profiles p ON p.id = pdis.employee_id
      WHERE pdis.id = pdi_objectives.pdi_id
      AND p.manager_id = auth.uid()
      AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pdis
      JOIN public.profiles p ON p.id = pdis.employee_id
      WHERE pdis.id = pdi_objectives.pdi_id
      AND p.manager_id = auth.uid()
      AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "HR can manage objectives of tenant PDIs" ON pdi_objectives
  FOR ALL
  USING (
    public.get_my_profile_role() = 'hr'
    AND (SELECT tenant_id FROM pdis WHERE pdis.id = pdi_objectives.pdi_id LIMIT 1) = public.get_my_profile_tenant_id()
  )
  WITH CHECK (
    (SELECT tenant_id FROM pdis WHERE pdis.id = pdi_objectives.pdi_id LIMIT 1) = public.get_my_profile_tenant_id()
  );

-- pdi_actions
CREATE TABLE pdi_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_objective_id UUID NOT NULL REFERENCES pdi_objectives(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('course', 'practice')),
  responsible_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  course_assignment_id UUID REFERENCES course_assignments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pdi_actions_pdi_objective_id ON pdi_actions(pdi_objective_id);
CREATE INDEX idx_pdi_actions_responsible_user_id ON pdi_actions(responsible_user_id);
CREATE INDEX idx_pdi_actions_status ON pdi_actions(status);
CREATE INDEX idx_pdi_actions_due_date ON pdi_actions(due_date);
CREATE INDEX idx_pdi_actions_course_assignment_id ON pdi_actions(course_assignment_id);

ALTER TABLE pdi_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View actions of visible PDIs" ON pdi_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pdi_objectives o
      JOIN pdis ON pdis.id = o.pdi_id
      WHERE o.id = pdi_actions.pdi_objective_id
      AND (
        pdis.employee_id = auth.uid()
        OR (
          public.get_my_profile_role() = 'manager'
          AND pdis.tenant_id = public.get_my_profile_tenant_id()
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pdis.employee_id AND p.manager_id = auth.uid())
        )
        OR (
          public.get_my_profile_role() = 'hr'
          AND pdis.tenant_id = public.get_my_profile_tenant_id()
        )
      )
    )
  );

CREATE POLICY "Managers can manage actions of direct report PDIs" ON pdi_actions
  FOR ALL
  USING (
    public.get_my_profile_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM pdi_objectives o
      JOIN pdis ON pdis.id = o.pdi_id
      JOIN public.profiles p ON p.id = pdis.employee_id
      WHERE o.id = pdi_actions.pdi_objective_id
      AND p.manager_id = auth.uid()
      AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pdi_objectives o
      JOIN pdis ON pdis.id = o.pdi_id
      JOIN public.profiles p ON p.id = pdis.employee_id
      WHERE o.id = pdi_actions.pdi_objective_id
      AND p.manager_id = auth.uid()
      AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "HR can manage actions of tenant PDIs" ON pdi_actions
  FOR ALL
  USING (
    public.get_my_profile_role() = 'hr'
    AND EXISTS (
      SELECT 1 FROM pdi_objectives o
      JOIN pdis ON pdis.id = o.pdi_id
      WHERE o.id = pdi_actions.pdi_objective_id
      AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pdi_objectives o
      JOIN pdis ON pdis.id = o.pdi_id
      WHERE o.id = pdi_actions.pdi_objective_id
      AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  );

-- Employee can only UPDATE own assigned actions (status)
CREATE POLICY "Employees can update own assigned action status" ON pdi_actions
  FOR UPDATE
  USING (responsible_user_id = auth.uid())
  WITH CHECK (responsible_user_id = auth.uid());

-- pdi_checkins
CREATE TABLE pdi_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id UUID NOT NULL REFERENCES pdis(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pdi_checkins_pdi_id ON pdi_checkins(pdi_id);
CREATE INDEX idx_pdi_checkins_created_at ON pdi_checkins(pdi_id, created_at);

ALTER TABLE pdi_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View checkins of visible PDIs" ON pdi_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pdis
      WHERE pdis.id = pdi_checkins.pdi_id
      AND (
        pdis.employee_id = auth.uid()
        OR (
          public.get_my_profile_role() = 'manager'
          AND pdis.tenant_id = public.get_my_profile_tenant_id()
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pdis.employee_id AND p.manager_id = auth.uid())
        )
        OR (
          public.get_my_profile_role() = 'hr'
          AND pdis.tenant_id = public.get_my_profile_tenant_id()
        )
      )
    )
  );

CREATE POLICY "Employees can insert checkins on own PDI" ON pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM pdis WHERE pdis.id = pdi_checkins.pdi_id AND pdis.employee_id = auth.uid())
  );

CREATE POLICY "Managers can insert checkins on direct report PDIs" ON pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_my_profile_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM pdis
      JOIN public.profiles p ON p.id = pdis.employee_id
      WHERE pdis.id = pdi_checkins.pdi_id AND p.manager_id = auth.uid()
      AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "HR can insert checkins on tenant PDIs" ON pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_my_profile_role() = 'hr'
    AND EXISTS (SELECT 1 FROM pdis WHERE pdis.id = pdi_checkins.pdi_id AND pdis.tenant_id = public.get_my_profile_tenant_id())
  );

-- RPC: progress for a PDI (total_actions, completed_actions, progress_pct)
CREATE OR REPLACE FUNCTION public.get_pdi_progress(p_pdi_id UUID)
RETURNS TABLE (
  total_actions BIGINT,
  completed_actions BIGINT,
  progress_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total BIGINT;
  v_completed BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM pdi_actions a
  JOIN pdi_objectives o ON o.id = a.pdi_objective_id
  WHERE o.pdi_id = p_pdi_id;

  SELECT COUNT(*) INTO v_completed
  FROM pdi_actions a
  JOIN pdi_objectives o ON o.id = a.pdi_objective_id
  WHERE o.pdi_id = p_pdi_id AND a.status = 'completed';

  total_actions := v_total;
  completed_actions := v_completed;
  progress_pct := CASE WHEN v_total > 0 THEN ROUND(100.0 * v_completed / v_total, 1) ELSE 0 END;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_pdi_progress(UUID) IS 'Returns total_actions, completed_actions, progress_pct for a PDI. Caller must have row access to the PDI via RLS.';

GRANT EXECUTE ON FUNCTION public.get_pdi_progress(UUID) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON pdis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pdi_objectives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pdi_actions TO authenticated;
GRANT SELECT, INSERT ON pdi_checkins TO authenticated;
