-- Migration 070: RPC for backoffice tenant list with active user count
-- Callable only by users with is_platform_admin = true.

CREATE OR REPLACE FUNCTION public.get_backoffice_tenants()
RETURNS TABLE (
  id uuid,
  slug text,
  company_name text,
  created_at timestamptz,
  max_users integer,
  active_user_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.get_my_profile_is_platform_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.slug,
    t.company_name,
    t.created_at,
    t.max_users,
    COALESCE(p.cnt, 0)::bigint AS active_user_count
  FROM public.tenants t
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.profiles p
    WHERE p.tenant_id = t.id AND p.is_active = true
  ) p ON true
  ORDER BY t.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_backoffice_tenants() IS 'Returns all tenants with active user count. Only callable by platform admins.';

GRANT EXECUTE ON FUNCTION public.get_backoffice_tenants() TO authenticated;

-- Single tenant detail for backoffice (company info + user count + first HR admin)
CREATE OR REPLACE FUNCTION public.get_backoffice_tenant_detail(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  slug text,
  company_name text,
  created_at timestamptz,
  max_users integer,
  active_user_count bigint,
  admin_name text,
  admin_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.get_my_profile_is_platform_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.slug,
    t.company_name,
    t.created_at,
    t.max_users,
    COALESCE(p.cnt, 0)::bigint AS active_user_count,
    hr.name AS admin_name,
    hr.email AS admin_email
  FROM public.tenants t
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.profiles p
    WHERE p.tenant_id = t.id AND p.is_active = true
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT pr.name, pr.email
    FROM public.profiles pr
    WHERE pr.tenant_id = t.id AND pr.role = 'hr'
    ORDER BY pr.created_at ASC
    LIMIT 1
  ) hr ON true
  WHERE t.id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.get_backoffice_tenant_detail(uuid) IS 'Returns one tenant with active user count and first HR admin. Only callable by platform admins.';

GRANT EXECUTE ON FUNCTION public.get_backoffice_tenant_detail(uuid) TO authenticated;
