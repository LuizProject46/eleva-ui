-- Migration 006: Centro de custo em profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cost_center TEXT;
COMMENT ON COLUMN profiles.cost_center IS 'Centro de custo do colaborador';

-- Atualizar trigger para incluir cost_center
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

  INSERT INTO public.profiles (id, email, name, role, tenant_id, manager_id, department, position, cost_center)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'employee'),
    v_tenant_id,
    v_manager_id,
    v_department,
    v_position,
    v_cost_center
  );
  RETURN NEW;
END;
$$;
