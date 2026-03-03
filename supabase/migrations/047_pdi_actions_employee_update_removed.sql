-- Remove employee UPDATE on pdi_actions so only Manager/HR can update action status.
-- Aligns with Phase 1: employees are read-only on PDIs.
DROP POLICY IF EXISTS "Employees can update own assigned action status" ON pdi_actions;
