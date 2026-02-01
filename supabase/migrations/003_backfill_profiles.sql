-- Backfill: criar profiles para usuários auth que ainda não têm
-- Execute APÓS 001 e 002 no Supabase SQL Editor
-- Útil quando: usuários foram criados antes do trigger ou o trigger falhou

INSERT INTO public.profiles (id, email, name, role, tenant_id)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE((u.raw_user_meta_data->>'role')::public.user_role, 'employee'),
  (SELECT t.id FROM public.tenants t WHERE t.slug = 'demo' LIMIT 1)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
