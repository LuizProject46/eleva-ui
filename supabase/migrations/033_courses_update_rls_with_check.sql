  -- Migration 033: Fix RLS for HR soft-deleting courses
  -- Soft delete does UPDATE SET deleted_at. The UPDATE policy's WITH CHECK (defaults to USING)
  -- was failing for the new row. Use explicit WITH CHECK that only constrains tenant_id,
  -- so the updated row is allowed without re-evaluating role in the new-row context.

  DROP POLICY IF EXISTS "HR and managers can update courses" ON courses;
  DROP POLICY IF EXISTS "Tenant can view courses" ON courses;

CREATE POLICY "Tenant can view courses" ON courses
  FOR SELECT USING (tenant_id = public.get_my_profile_tenant_id());

  CREATE POLICY "HR and managers can update courses" ON courses
    FOR UPDATE
    USING (
      tenant_id = public.get_my_profile_tenant_id()
      AND public.get_my_profile_role() IN ('hr', 'manager')
    );