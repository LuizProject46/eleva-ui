-- Migration 002: Multi-tenant (whitelabel) support
-- Run this script in Supabase SQL Editor after 001_create_profiles.sql

-- Tabela de tenants (empresas/clientes B2B)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  accent_color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar tenant_id em profiles
ALTER TABLE profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);

-- RLS para tenants (leitura pública para config de marca)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tenants" ON tenants
  FOR SELECT USING (is_active = true);

-- Garantir que anon e authenticated possam ler tenants
GRANT SELECT ON tenants TO anon;
GRANT SELECT ON tenants TO authenticated;

-- Funções auxiliares para evitar recursão nas políticas RLS
-- (consultar profiles dentro da policy de profiles causa infinite recursion)
CREATE OR REPLACE FUNCTION public.get_my_profile_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Dropar políticas antigas de profiles para recriar com tenant
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "HR can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view team profiles" ON profiles;
DROP POLICY IF EXISTS "HR and managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "HR and managers can view tenant profiles" ON profiles;

-- Novas políticas (sem subquery em profiles = sem recursão)
-- 1. Usuário sempre pode ver o próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. HR e Managers podem ver perfis do mesmo tenant (usa funções que bypassam RLS)
CREATE POLICY "HR and managers can view tenant profiles" ON profiles
  FOR SELECT USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_my_profile_tenant_id()
    AND public.get_my_profile_role() IN ('manager', 'hr')
  );

-- 3. Usuário pode atualizar próprio perfil (para associar tenant_id no primeiro login)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Atualizar trigger para incluir tenant_id (se fornecido em raw_user_meta_data)
-- Usa search_path vazio e referências explícitas para evitar erro 42P01
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'employee'),
    v_tenant_id
  );
  RETURN NEW;
END;
$$;

-- Tenant demo para desenvolvimento
INSERT INTO tenants (slug, company_name, primary_color, accent_color, is_active)
VALUES (
  'demo',
  'Facholi',
  '145 75% 38%',
  '24 95% 60%',
  true
)
ON CONFLICT (slug) DO NOTHING;
