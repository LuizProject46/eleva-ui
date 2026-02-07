-- Run this script in Supabase SQL Editor to create profiles table and auth trigger.
-- See: Dashboard > SQL Editor > New query
--
-- IMPORTANTE: Este script requer um projeto Supabase com Auth habilitado.
-- O erro "relation users does not exist" indica que auth.users não existe -
-- use o Supabase Dashboard (não PostgreSQL puro) e um projeto com Auth ativo.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'auth.users não encontrado. Execute este script no Supabase SQL Editor (projeto com Auth habilitado).';
  END IF;
END $$;

-- Enum para roles
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'hr');

-- Tabela de perfis
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'hr',
  department TEXT,
  position TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para evitar recursão nas políticas (consultar profiles na policy causa loop)
CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Users can view own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- HR e Managers podem ver todos os perfis (usa função que bypassa RLS = sem recursão)
CREATE POLICY "HR and managers can view all profiles" ON profiles
  FOR SELECT USING (public.get_my_profile_role() IN ('manager', 'hr'));

-- Trigger: create profile on signup
-- Usa search_path vazio e referências explícitas para evitar erro 42P01
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'employee')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
