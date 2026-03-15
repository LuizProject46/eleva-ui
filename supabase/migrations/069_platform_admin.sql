-- Migration 069: Platform administrators for tenant management and backoffice
-- Users with is_platform_admin = true can manage all tenants (list, create, update).
-- First platform admin(s) must be set manually, e.g.:
--   UPDATE profiles SET is_platform_admin = true WHERE email = 'admin@platform.com';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.is_platform_admin IS 'When true, user can access backoffice and manage tenants (create, list, update). Set manually for platform staff.';

CREATE OR REPLACE FUNCTION public.get_my_profile_is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Platform admins can SELECT all tenants (including inactive)
CREATE POLICY "Platform admins can view all tenants" ON tenants
  FOR SELECT
  USING (public.get_my_profile_is_platform_admin());

-- Platform admins can INSERT tenants (for provisioning)
CREATE POLICY "Platform admins can insert tenants" ON tenants
  FOR INSERT
  WITH CHECK (public.get_my_profile_is_platform_admin());

-- Platform admins can UPDATE any tenant
CREATE POLICY "Platform admins can update tenants" ON tenants
  FOR UPDATE
  USING (public.get_my_profile_is_platform_admin())
  WITH CHECK (public.get_my_profile_is_platform_admin());
