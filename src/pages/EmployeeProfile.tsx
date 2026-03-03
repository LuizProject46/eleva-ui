import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { UserRole } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, User } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  hr: 'RH',
  manager: 'GESTOR',
  employee: 'COLABORADOR',
};

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string | null;
  position: string | null;
  manager_id: string | null;
  manager_name?: string | null;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
}

export default function EmployeeProfile() {
  const { userId } = useParams<{ userId: string }>();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoadingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, department, position, manager_id, avatar_url, avatar_thumb_url')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      toast.error('Erro ao carregar perfil');
      setIsLoadingProfile(false);
      return;
    }
    if (!data) {
      setProfile(null);
      setIsLoadingProfile(false);
      return;
    }
    const row = data as ProfileRow;
    if (row.manager_id) {
      const { data: managerData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', row.manager_id)
        .maybeSingle();
      row.manager_name = (managerData as { name?: string } | null)?.name ?? null;
    }
    setProfile(row);
    setIsLoadingProfile(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (!userId) {
    return <Navigate to="/employees" replace />;
  }

  if (isLoadingProfile) {
    return (
      <MainLayout>
        <div className="p-4 md:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="p-4 md:p-8 space-y-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/employees">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <p className="text-muted-foreground">Perfil não encontrado ou você não tem permissão para visualizá-lo.</p>
          <Button variant="link" asChild className="p-0">
            <Link to="/employees">Voltar aos colaboradores</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/employees">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground truncate">Perfil</h1>
            <p className="text-sm text-muted-foreground truncate">{profile.name}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 md:gap-6">
            <UserAvatar
              avatarUrl={profile.avatar_url}
              avatarThumbUrl={profile.avatar_thumb_url}
              name={profile.name}
              size="lg"
              useThumb={false}
              className="h-16 w-16 md:h-20 md:w-20 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <p className="text-sm text-muted-foreground">
                {ROLE_LABELS[profile.role] ?? profile.role}
                {profile.department && ` · ${profile.department}`}
                {profile.position && ` · ${profile.position}`}
              </p>
              {profile.manager_name && (
                <p className="text-sm text-muted-foreground">Gestor: {profile.manager_name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground" />
            Dados do perfil
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Nome</dt>
              <dd className="font-medium text-foreground">{profile.name}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="text-foreground">{profile.email}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Cargo</dt>
              <dd className="text-foreground">{profile.position ?? '—'}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Setor</dt>
              <dd className="text-foreground">{profile.department ?? '—'}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Papel</dt>
              <dd className="text-foreground">{ROLE_LABELS[profile.role] ?? profile.role}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Gestor</dt>
              <dd className="text-foreground">{profile.manager_name ?? '—'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </MainLayout>
  );
}
