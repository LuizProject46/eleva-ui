import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { UserRole, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Grid3x3, User, KeyRound, Eye, EyeOff } from 'lucide-react';
import {
  getNineBoxQuadrantMeta,
  nineBoxBadgeClassName,
} from '@/modules/nineBox/nineBoxQuadrants';
import { getNineBoxEvaluationByEmployee } from '@/services/nineBoxService';
import { cn } from '@/lib/utils';

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
  is_active?: boolean | null;
}

export default function EmployeeProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user, canManageUsers, isHR } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminPasswordFields, setShowAdminPasswordFields] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoadingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, department, position, manager_id, avatar_url, avatar_thumb_url, is_active')
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

  const showNineBoxBlock = Boolean(user?.tenantId && userId && canManageUsers());

  const canHrSetPasswordForProfile =
    isHR() &&
    profile &&
    user?.id &&
    profile.id !== user.id &&
    profile.is_active !== false;

  const handleSetUserPasswordSubmit = async () => {
    if (!profile) return;
    if (adminNewPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setIsSettingPassword(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('set-user-password', {
        body: { user_id: profile.id, new_password: adminNewPassword },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        toast.error(String(data.error));
        return;
      }

      if (error) {
        toast.error(error.message ?? 'Erro ao definir senha.');
        return;
      }

      toast.success('Senha definida com sucesso.');
      setPasswordDialogOpen(false);
      setAdminNewPassword('');
      setAdminConfirmPassword('');
    } catch {
      toast.error('Erro ao definir senha. Tente novamente.');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const { data: nineBoxEval, isLoading: nineBoxLoading } = useQuery({
    queryKey: ['nine-box-employee', user?.tenantId, userId],
    queryFn: () => getNineBoxEvaluationByEmployee(user!.tenantId!, userId!),
    enabled: showNineBoxBlock,
  });

  const nineBoxMeta = useMemo(
    () =>
      nineBoxEval != null
        ? getNineBoxQuadrantMeta(nineBoxEval.performance, nineBoxEval.potential)
        : null,
    [nineBoxEval]
  );

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
              {canHrSetPasswordForProfile && (
                <div className="pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setAdminNewPassword('');
                      setAdminConfirmPassword('');
                      setShowAdminPasswordFields(false);
                      setPasswordDialogOpen(true);
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                    Definir nova senha
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog
          open={passwordDialogOpen}
          onOpenChange={(open) => {
            setPasswordDialogOpen(open);
            if (!open) {
              setAdminNewPassword('');
              setAdminConfirmPassword('');
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Definir nova senha</DialogTitle>
              <DialogDescription>
                Nova senha de acesso para {profile.name} ({profile.email}).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="employee-profile-new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="employee-profile-new-password"
                    type={showAdminPasswordFields ? 'text' : 'password'}
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPasswordFields((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showAdminPasswordFields ? 'Ocultar senhas' : 'Mostrar senhas'}
                  >
                    {showAdminPasswordFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-profile-confirm-password">Confirmar senha</Label>
                <Input
                  id="employee-profile-confirm-password"
                  type={showAdminPasswordFields ? 'text' : 'password'}
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordDialogOpen(false)}
                disabled={isSettingPassword}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSetUserPasswordSubmit}
                disabled={
                  isSettingPassword ||
                  !adminNewPassword.trim() ||
                  !adminConfirmPassword.trim()
                }
              >
                {isSettingPassword ? 'Salvando...' : 'Salvar senha'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showNineBoxBlock && nineBoxLoading ? (
          <div className="rounded-lg border border-border bg-card p-4 md:p-6">
            <Skeleton className="h-5 w-40 mb-3" />
            <Skeleton className="h-8 w-56 rounded-md" />
          </div>
        ) : null}

        {showNineBoxBlock && !nineBoxLoading && nineBoxEval && nineBoxMeta ? (
          <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-2">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Grid3x3 className="w-5 h-5 text-muted-foreground" />
              Matriz 9Box
            </h2>
            <p className="text-xs text-muted-foreground">Posição atual neste quadrante.</p>
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium',
                nineBoxBadgeClassName(nineBoxMeta.tier)
              )}
            >
              {nineBoxMeta.label}
            </span>
          </div>
        ) : null}

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
