-- Migration 008: Hierarquia e permissões (RH / GESTOR / COLABORADOR)
-- Run after 001-007

-- 1. Status ativo/inativo em profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN profiles.is_active IS 'Usado para ativar/desativar usuário; apenas RH pode alterar';

-- 2. Trigger handle_new_user: incluir is_active (novos usuários ativos)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_manager_id UUID;
  v_department TEXT;
  v_position TEXT;
  v_cost_center TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  END IF;
  IF NEW.raw_user_meta_data->>'manager_id' IS NOT NULL THEN
    v_manager_id := (NEW.raw_user_meta_data->>'manager_id')::UUID;
  END IF;
  v_department := NEW.raw_user_meta_data->>'department';
  v_position := NEW.raw_user_meta_data->>'position';
  v_cost_center := NEW.raw_user_meta_data->>'cost_center';

  INSERT INTO public.profiles (id, email, name, role, tenant_id, manager_id, department, position, cost_center, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'employee'),
    v_tenant_id,
    v_manager_id,
    v_department,
    v_position,
    v_cost_center,
    true
  );
  RETURN NEW;
END;
$$;

-- 3. Garantir pelo menos um RH por tenant (primeiro usuário do tenant = RH quando não há RH)
UPDATE public.profiles p
SET role = 'hr'::public.user_role
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) AS rn
  FROM public.profiles
  WHERE tenant_id IS NOT NULL
  AND tenant_id NOT IN (
    SELECT tenant_id FROM public.profiles WHERE role = 'hr' AND tenant_id IS NOT NULL
  )
) sub
WHERE p.id = sub.id AND sub.rn = 1;

-- 3b. SELECT: Gestor pode ver outros gestores e RH do tenant (para dropdown de reassign)
CREATE POLICY "Managers can view tenant managers and HR" ON profiles
  FOR SELECT
  USING (
    public.get_my_profile_role() = 'manager'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
    AND role IN ('manager', 'hr')
  );

-- 4. RLS UPDATE: HR pode atualizar qualquer perfil do tenant
CREATE POLICY "HR can update tenant profiles" ON profiles
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

-- 5. RLS UPDATE: Gestor pode atualizar apenas subordinados (manager_id = self)
-- O trigger abaixo restringe que o gestor só altere manager_id (equipe), não role nem is_active
CREATE POLICY "Managers can update team profiles" ON profiles
  FOR UPDATE
  USING (
    public.get_my_profile_role() = 'manager'
    AND manager_id = auth.uid()
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.get_my_profile_tenant_id()
  );

-- 6. Trigger: gestor não pode alterar role nem is_active (apenas manager_id e outros campos permitidos)
CREATE OR REPLACE FUNCTION public.enforce_manager_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_profile_role() = 'manager' THEN
    NEW.role := OLD.role;
    NEW.is_active := OLD.is_active;
  END IF;
  IF public.get_my_profile_role() = 'employee' THEN
    NEW.role := OLD.role;
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_enforce_manager_update_restrictions
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_manager_update_restrictions();
