-- Migration 023: Periodicity configuration and reminder tracking for evaluations and assessments.
-- HR configures intervals and lead times; cron job uses periodicity_reminder_sent to avoid duplicate sends.

-- Periodicity config: one row per tenant per entity type (evaluation | assessment)
CREATE TABLE periodicity_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('evaluation', 'assessment')),
  interval_kind TEXT NOT NULL CHECK (interval_kind IN ('bimonthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  custom_interval_days INT CHECK (custom_interval_days IS NULL OR (custom_interval_days >= 1 AND custom_interval_days <= 365)),
  custom_interval_months INT CHECK (custom_interval_months IS NULL OR (custom_interval_months >= 1 AND custom_interval_months <= 24)),
  reference_start_date DATE NOT NULL,
  notification_lead_days INT[] NOT NULL DEFAULT '{7, 14, 30}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, entity_type)
);

CREATE INDEX idx_periodicity_config_tenant ON periodicity_config(tenant_id);

COMMENT ON TABLE periodicity_config IS 'HR-defined periodicity for evaluations and assessments; used by cron to compute cycles and send reminders.';

ALTER TABLE periodicity_config ENABLE ROW LEVEL SECURITY;

-- Tenant members can read config for their tenant
CREATE POLICY "Tenant can view periodicity_config" ON periodicity_config
  FOR SELECT USING (tenant_id = public.get_my_profile_tenant_id());

-- Only HR can insert/update/delete for their tenant
CREATE POLICY "HR can insert periodicity_config" ON periodicity_config
  FOR INSERT WITH CHECK (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "HR can update periodicity_config" ON periodicity_config
  FOR UPDATE USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

CREATE POLICY "HR can delete periodicity_config" ON periodicity_config
  FOR DELETE USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id = public.get_my_profile_tenant_id()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON periodicity_config TO authenticated;

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION public.set_periodicity_config_updated_at()
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

CREATE TRIGGER periodicity_config_updated_at
  BEFORE UPDATE ON periodicity_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_periodicity_config_updated_at();

-- Reminder sent tracking: only cron (service_role) should read/write; no policies = no access for authenticated
CREATE TABLE periodicity_reminder_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('evaluation', 'assessment')),
  period_start_date DATE NOT NULL,
  lead_days INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, entity_type, period_start_date, lead_days)
);

CREATE INDEX idx_periodicity_reminder_sent_lookup ON periodicity_reminder_sent(tenant_id, entity_type, period_start_date, lead_days);

COMMENT ON TABLE periodicity_reminder_sent IS 'Tracks sent period reminders to avoid duplicates; accessed only by cron Edge Function (service_role).';

ALTER TABLE periodicity_reminder_sent ENABLE ROW LEVEL SECURITY;

-- No policies: authenticated users cannot read or write; service_role bypasses RLS
-- Grant is not given to authenticated so they cannot access at all; cron uses service_role
REVOKE ALL ON periodicity_reminder_sent FROM authenticated;
GRANT SELECT, INSERT ON periodicity_reminder_sent TO service_role;

-- Extend notifications.type to include period reminder types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'evaluation_received',
    'feedback_received',
    'evaluation_period_reminder',
    'assessment_period_reminder'
  )
);
