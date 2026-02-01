-- Migration 004: Estrutura organizacional (gestor-equipe)
-- Run after 001, 002, 003

-- Adicionar manager_id para hierarquia gestor-equipe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);

-- Atualizar trigger para incluir manager_id, department, position do convite
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
BEGIN
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  END IF;
  IF NEW.raw_user_meta_data->>'manager_id' IS NOT NULL THEN
    v_manager_id := (NEW.raw_user_meta_data->>'manager_id')::UUID;
  END IF;
  v_department := NEW.raw_user_meta_data->>'department';
  v_position := NEW.raw_user_meta_data->>'position';

  INSERT INTO public.profiles (id, email, name, role, tenant_id, manager_id, department, position)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'employee'),
    v_tenant_id,
    v_manager_id,
    v_department,
    v_position
  );
  RETURN NEW;
END;
$$;

-- Dropar política antiga de gestores/HR
DROP POLICY IF EXISTS "HR and managers can view tenant profiles" ON profiles;

-- RH: vê todos os perfis do mesmo tenant
CREATE POLICY "HR can view all tenant profiles" ON profiles
  FOR SELECT USING (
    public.get_my_profile_role() = 'hr'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
  );

-- Gestor: vê própria equipe (manager_id = self) e próprio perfil
CREATE POLICY "Managers can view team profiles" ON profiles
  FOR SELECT USING (
    public.get_my_profile_role() = 'manager'
    AND (
      manager_id = auth.uid()
      OR id = auth.uid()
    )
    AND tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
  );
