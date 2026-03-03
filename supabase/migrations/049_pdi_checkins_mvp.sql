-- PDI Check-ins MVP: add checkin_date, overall_status, manager_comment, employee_comment;
-- migrate existing comment; restrict INSERT to active PDIs; add UPDATE policies.

-- Add new columns (nullable first for backfill)
ALTER TABLE pdi_checkins
  ADD COLUMN IF NOT EXISTS checkin_date DATE,
  ADD COLUMN IF NOT EXISTS overall_status TEXT,
  ADD COLUMN IF NOT EXISTS manager_comment TEXT,
  ADD COLUMN IF NOT EXISTS employee_comment TEXT;

-- Backfill: checkin_date and overall_status
UPDATE pdi_checkins
SET
  checkin_date = (created_at AT TIME ZONE 'UTC')::date,
  overall_status = 'in_progress'
WHERE checkin_date IS NULL OR overall_status IS NULL;

-- Backfill: split comment into manager_comment vs employee_comment by author
UPDATE pdi_checkins c
SET
  manager_comment = CASE WHEN p.employee_id = c.author_id THEN NULL ELSE c.comment END,
  employee_comment = CASE WHEN p.employee_id = c.author_id THEN c.comment ELSE NULL END
FROM pdis p
WHERE p.id = c.pdi_id;

-- Set NOT NULL and defaults for new rows
ALTER TABLE pdi_checkins
  ALTER COLUMN checkin_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN checkin_date SET NOT NULL,
  ALTER COLUMN overall_status SET DEFAULT 'in_progress',
  ALTER COLUMN overall_status SET NOT NULL;

ALTER TABLE pdi_checkins
  ADD CONSTRAINT pdi_checkins_overall_status_check
  CHECK (overall_status IN ('not_started', 'in_progress', 'completed'));

-- Drop old comment column
ALTER TABLE pdi_checkins DROP COLUMN IF EXISTS comment;

-- Drop existing INSERT policies so we can recreate with active-only
DROP POLICY IF EXISTS "Employees can insert checkins on own PDI" ON pdi_checkins;
DROP POLICY IF EXISTS "Managers can insert checkins on direct report PDIs" ON pdi_checkins;
DROP POLICY IF EXISTS "HR can insert checkins on tenant PDIs" ON pdi_checkins;

-- INSERT: only for active PDIs
CREATE POLICY "Employees can insert checkins on own active PDI" ON pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pdis
      WHERE pdis.id = pdi_checkins.pdi_id
        AND pdis.employee_id = auth.uid()
        AND pdis.status = 'active'
    )
  );

CREATE POLICY "Managers can insert checkins on direct report active PDIs" ON pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_my_profile_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM pdis
      JOIN public.profiles p ON p.id = pdis.employee_id
      WHERE pdis.id = pdi_checkins.pdi_id
        AND p.manager_id = auth.uid()
        AND pdis.tenant_id = public.get_my_profile_tenant_id()
        AND pdis.status = 'active'
    )
  );

CREATE POLICY "HR can insert checkins on tenant active PDIs" ON pdi_checkins
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_my_profile_role() = 'hr'
    AND EXISTS (
      SELECT 1 FROM pdis
      WHERE pdis.id = pdi_checkins.pdi_id
        AND pdis.tenant_id = public.get_my_profile_tenant_id()
        AND pdis.status = 'active'
    )
  );

-- UPDATE: HR/Manager on check-ins of PDIs they can manage
CREATE POLICY "Managers can update checkins of direct report PDIs" ON pdi_checkins
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM pdis
      JOIN public.profiles p ON p.id = pdis.employee_id
      WHERE pdis.id = pdi_checkins.pdi_id
        AND p.manager_id = auth.uid()
        AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pdis
      JOIN public.profiles p ON p.id = pdis.employee_id
      WHERE pdis.id = pdi_checkins.pdi_id
        AND p.manager_id = auth.uid()
        AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  );

CREATE POLICY "HR can update checkins of tenant PDIs" ON pdi_checkins
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'hr'
    AND EXISTS (
      SELECT 1 FROM pdis
      WHERE pdis.id = pdi_checkins.pdi_id
        AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pdis
      WHERE pdis.id = pdi_checkins.pdi_id
        AND pdis.tenant_id = public.get_my_profile_tenant_id()
    )
  );

-- UPDATE: Employee on check-ins of own PDIs (app will only send employee_comment)
CREATE POLICY "Employees can update checkins of own PDI" ON pdi_checkins
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pdis
      WHERE pdis.id = pdi_checkins.pdi_id AND pdis.employee_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pdis
      WHERE pdis.id = pdi_checkins.pdi_id AND pdis.employee_id = auth.uid()
    )
  );

GRANT UPDATE ON pdi_checkins TO authenticated;

COMMENT ON COLUMN pdi_checkins.checkin_date IS 'Date of the check-in (explicit, may differ from created_at date)';
COMMENT ON COLUMN pdi_checkins.overall_status IS 'Progress snapshot: not_started, in_progress, completed';
COMMENT ON COLUMN pdi_checkins.manager_comment IS 'Comment from manager/HR';
COMMENT ON COLUMN pdi_checkins.employee_comment IS 'Optional comment from employee';
