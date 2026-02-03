-- Migration 011: login_cover_url for tenants + RLS UPDATE for HR branding
-- Whitelabel: login screen cover image and allow HR to update tenant branding

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS login_cover_url TEXT;

COMMENT ON COLUMN tenants.login_cover_url IS 'URL of the image shown on the login screen left panel. If null, solid primary color is used.';

-- Only HR of the same tenant can update tenant row (branding)
CREATE POLICY "HR can update own tenant branding" ON tenants
  FOR UPDATE
  USING (id = public.get_my_profile_tenant_id())
  WITH CHECK (
    id = public.get_my_profile_tenant_id()
    AND public.get_my_profile_role() = 'hr'
  );

-- Grant update to authenticated (RLS will restrict to HR)
GRANT UPDATE ON tenants TO authenticated;
