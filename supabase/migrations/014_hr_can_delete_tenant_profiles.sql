-- HR can delete profiles of the same tenant (except self).
-- Used when removing a collaborator via REST API; auth.users is not deleted by this (handled separately if needed).
CREATE POLICY "HR can delete tenant profiles" ON profiles
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
    AND id <> auth.uid()
  );

GRANT DELETE ON profiles TO authenticated;
