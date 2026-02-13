-- Allow HR to delete periodicity_reminder_sent for their tenant when saving config.
-- Cron (service_role) unchanged; RLS restricts authenticated to DELETE only for own tenant.

GRANT DELETE ON periodicity_reminder_sent TO authenticated;

CREATE POLICY "HR can delete periodicity_reminder_sent for own tenant"
  ON periodicity_reminder_sent
  FOR DELETE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );
