-- Migration 071: Hide platform admin profiles from tenant users
-- Goal: profiles with is_platform_admin = true must not be visible to normal tenant users.
-- Only platform admins (backoffice) can see platform admin profiles.

-- Recreate SELECT policies with a guard against platform admin rows.
-- Note: RLS policies are permissive (OR). To enforce exclusion we must ensure ALL
-- SELECT policies that could match a platform admin row include this predicate.

DROP POLICY IF EXISTS "Authenticated users can view same sector or team" ON profiles;
DROP POLICY IF EXISTS "HR can view all tenant profiles" ON profiles;

CREATE POLICY "Authenticated users can view same sector or team" ON profiles
  FOR SELECT
  USING (
    -- always inside tenant
    tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()

    -- do not list self (own profile policy handles it)
    AND id <> auth.uid()

    -- platform admins are only visible to platform admins
    AND (
      COALESCE(is_platform_admin, false) = false
      OR public.get_my_profile_is_platform_admin()
    )

    AND (
      -- HR sees all (within tenant) except platform admins
      public.get_my_profile_role() = 'hr'

      -- manager: direct reports, same department, or HR
      OR (
        public.get_my_profile_role() = 'manager'
        AND (
          manager_id = auth.uid()
          OR department IS NOT DISTINCT FROM public.get_my_profile_department()
          OR role = 'hr'
        )
      )

      -- employee: same department
      OR (
        public.get_my_profile_role() = 'employee'
        AND department IS NOT DISTINCT FROM public.get_my_profile_department()
      )
    )
  );

CREATE POLICY "HR can view all tenant profiles" ON profiles
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
    AND (
      COALESCE(is_platform_admin, false) = false
      OR public.get_my_profile_is_platform_admin()
    )
  );

