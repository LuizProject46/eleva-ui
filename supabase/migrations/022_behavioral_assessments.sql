-- Migration 022: Behavioral (DISC) assessment — one row per user, RLS by role.
-- Employee/HR/Manager can take the assessment (own row). HR sees all tenant; Manager sees same dept/team.

CREATE TABLE behavioral_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  answers JSONB,
  result TEXT CHECK (result IS NULL OR result IN ('D', 'I', 'S', 'C')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX idx_behavioral_assessments_user_id ON behavioral_assessments(user_id);
CREATE INDEX idx_behavioral_assessments_tenant_id ON behavioral_assessments(tenant_id);
CREATE INDEX idx_behavioral_assessments_status ON behavioral_assessments(status);
CREATE INDEX idx_behavioral_assessments_tenant_status ON behavioral_assessments(tenant_id, status);

COMMENT ON TABLE behavioral_assessments IS 'DISC behavioral assessment: one per user; status and answers persisted for resume and admin list.';

ALTER TABLE behavioral_assessments ENABLE ROW LEVEL SECURITY;

-- SELECT: own row always; HR sees all in tenant; Manager sees same department or same team (manager_id = me)
CREATE POLICY "Users can view own assessment" ON behavioral_assessments
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "HR can view all tenant assessments" ON behavioral_assessments
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "Managers can view same sector or team assessments" ON behavioral_assessments
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id = public.get_my_profile_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = behavioral_assessments.user_id
        AND (
          p.department IS NOT DISTINCT FROM public.get_my_profile_department()
          OR p.manager_id = auth.uid()
        )
    )
  );

-- INSERT: only own row; tenant_id must match current user's tenant
CREATE POLICY "Users can insert own assessment" ON behavioral_assessments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- UPDATE: only own row
CREATE POLICY "Users can update own assessment" ON behavioral_assessments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION public.set_behavioral_assessments_updated_at()
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

CREATE TRIGGER behavioral_assessments_updated_at
  BEFORE UPDATE ON behavioral_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_behavioral_assessments_updated_at();

GRANT SELECT, INSERT, UPDATE ON behavioral_assessments TO authenticated;

-- View: one row per eligible user (employee, hr, manager) with assessment status for admin list.
-- RLS on profiles and behavioral_assessments applies when selecting from the view.
CREATE VIEW assessment_admin_list AS
SELECT
  p.id AS user_id,
  p.name,
  p.department,
  p.manager_id,
  COALESCE(b.status, 'not_started') AS status,
  b.completed_at
FROM profiles p
LEFT JOIN behavioral_assessments b ON b.user_id = p.id
WHERE p.role IN ('employee', 'hr', 'manager')
  AND p.tenant_id IS NOT NULL;

GRANT SELECT ON assessment_admin_list TO authenticated;
