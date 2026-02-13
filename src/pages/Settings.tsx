import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, User, Save, CalendarClock, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { isHexColor, normalizeHex } from '@/lib/branding';
import { ImageUpload } from '@/components/settings/ImageUpload';
import { PeriodicityConfig } from '@/components/settings/PeriodicityConfig';
import { UserAvatar } from '@/components/UserAvatar';
import { uploadAvatar, validateAvatarFile } from '@/services/avatarService';
import { supabase } from '@/lib/supabase';

function normalizeHexInput(value: string): string {
  const v = value.trim().replace(/^#/, '');
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[0]! + v[0];
    const g = v[1]! + v[1];
    const b = v[2]! + v[2];
    return `#${r}${g}${b}`;
  }
  return value;
}

export default function Settings() {
  const { user, isHR, refreshUser } = useAuth();
  const { brand, updateBrand } = useBrand();
  const { tenant, refetchTenant } = useTenant();
  const showBrandSettings = isHR();
  const canEditProfile = isHR();

  const [companyName, setCompanyName] = useState(brand.companyName);
  const [primaryColorHex, setPrimaryColorHex] = useState(brand.primaryColor);
  const [primaryColorError, setPrimaryColorError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(brand.logoUrl);
  const [loginCoverUrl, setLoginCoverUrl] = useState<string | undefined>(brand.loginCoverUrl);
  const [isSaving, setIsSaving] = useState(false);

  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileDepartment, setProfileDepartment] = useState(user?.department ?? '');
  const [profilePosition, setProfilePosition] = useState(user?.position ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [profileAvatarPreviewUrl, setProfileAvatarPreviewUrl] = useState<string | null>(null);
  const [profileAvatarPendingFile, setProfileAvatarPendingFile] = useState<File | null>(null);
  const [profileAvatarRemoveRequested, setProfileAvatarRemoveRequested] = useState(false);
  const [profileAvatarError, setProfileAvatarError] = useState<string | null>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyName(brand.companyName);
    setPrimaryColorHex(brand.primaryColor);
    setLogoUrl(brand.logoUrl);
    setLoginCoverUrl(brand.loginCoverUrl);
  }, [brand.companyName, brand.primaryColor, brand.logoUrl, brand.loginCoverUrl]);

  useEffect(() => {
    setProfileName(user?.name ?? '');
    setProfileDepartment(user?.department ?? '');
    setProfilePosition(user?.position ?? '');
  }, [user?.name, user?.department, user?.position]);

  const handlePrimaryColorChange = (value: string) => {
    setPrimaryColorHex(value);
    if (value.trim() && !isHexColor(value)) {
      setPrimaryColorError('Cor inválida. Use hex (ex: #2d7a4a).');
    } else {
      setPrimaryColorError(null);
    }
  };

  const hasPendingAvatarChange =
    profileAvatarPendingFile !== null || profileAvatarRemoveRequested;

  const handleProfileAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProfileAvatarError(null);
    const err = validateAvatarFile(file);
    if (err) {
      setProfileAvatarError(err);
      return;
    }
    if (profileAvatarPreviewUrl) URL.revokeObjectURL(profileAvatarPreviewUrl);
    setProfileAvatarPreviewUrl(URL.createObjectURL(file));
    setProfileAvatarPendingFile(file);
    setProfileAvatarRemoveRequested(false);
  };

  const handleProfileAvatarRemove = () => {
    if (profileAvatarPreviewUrl) {
      URL.revokeObjectURL(profileAvatarPreviewUrl);
      setProfileAvatarPreviewUrl(null);
    }
    setProfileAvatarPendingFile(null);
    setProfileAvatarRemoveRequested(true);
    setProfileAvatarError(null);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    const hasProfileFieldsToSave = canEditProfile;
    if (!hasProfileFieldsToSave && !hasPendingAvatarChange) return;

    setIsSavingProfile(true);
    setProfileAvatarError(null);
    try {
      let avatarUrl: string | null | undefined;
      let avatarThumbUrl: string | null | undefined;

      if (profileAvatarPendingFile && user.tenantId) {
        const result = await uploadAvatar(user.tenantId, user.id, profileAvatarPendingFile);
        avatarUrl = result.avatarUrl;
        avatarThumbUrl = result.avatarThumbUrl;
      } else if (profileAvatarRemoveRequested) {
        avatarUrl = null;
        avatarThumbUrl = null;
      }

      const updates: Record<string, unknown> = {};
      if (hasProfileFieldsToSave) {
        updates.name = profileName.trim() || user.name;
        updates.department = profileDepartment.trim() || null;
        updates.position = profilePosition.trim() || null;
        updates.email = profileEmail.trim() || user.email;
      }
      if (profileAvatarPendingFile && avatarUrl !== undefined) {
        updates.avatar_url = avatarUrl;
        updates.avatar_thumb_url = avatarThumbUrl ?? null;
      }
      if (profileAvatarRemoveRequested) {
        updates.avatar_url = null;
        updates.avatar_thumb_url = null;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);

        if (error) {
          toast.error(error.message ?? 'Erro ao salvar perfil');
          return;
        }
      }

      if (profileAvatarPreviewUrl) URL.revokeObjectURL(profileAvatarPreviewUrl);
      setProfileAvatarPreviewUrl(null);
      setProfileAvatarPendingFile(null);
      setProfileAvatarRemoveRequested(false);
      await refreshUser();
      toast.success('Perfil atualizado');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível enviar a foto.';
      toast.error(msg);
      setProfileAvatarError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveBrand = async () => {
    if (!showBrandSettings || !tenant?.id) return;

    const hex = primaryColorHex.trim() ? normalizeHexInput(primaryColorHex) : brand.primaryColor;
    if (primaryColorHex.trim() && !isHexColor(primaryColorHex)) {
      setPrimaryColorError('Cor inválida. Use hex (ex: #2d7a4a).');
      return;
    }

    setIsSaving(true);
    setPrimaryColorError(null);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          company_name: companyName,
          primary_color: hex,
          logo_url: logoUrl ?? null,
          login_cover_url: loginCoverUrl ?? null,
        })
        .eq('id', tenant.id);

      if (error) {
        toast.error(error.message ?? 'Erro ao salvar');
        return;
      }

      updateBrand({
        companyName,
        primaryColor: hex,
        logoUrl,
        loginCoverUrl,
      });
      await refetchTenant();
      toast.success('Alterações salvas');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas preferências e personalize a plataforma
          </p>
        </div>

        <div className="space-y-6">
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display font-semibold text-foreground">
                Meu Perfil
              </h2>
            </div>

            <div className="space-y-6 mb-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="shrink-0">
                  {profileAvatarPreviewUrl ? (
                    <img
                      src={profileAvatarPreviewUrl}
                      alt="Preview"
                      className="h-20 w-20 rounded-full object-cover border border-border"
                    />
                  ) : profileAvatarRemoveRequested ? (
                    <UserAvatar
                      name={user?.name ?? ''}
                      size="lg"
                      className="h-20 w-20 border border-border"
                    />
                  ) : user?.avatar ? (
                    <UserAvatar
                      avatarUrl={user?.avatar}
                      avatarThumbUrl={user?.avatarThumbUrl}
                      name={user?.name ?? ''}
                      size="lg"
                      useThumb={false}
                      className="h-20 w-20 border border-border"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
                      <span className="text-sidebar-primary font-semibold">
                        {user?.name.toUpperCase().charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={profileAvatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleProfileAvatarFileChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => profileAvatarInputRef.current?.click()}
                      disabled={isSavingProfile}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Alterar foto
                    </Button>
                    {(user?.avatar || profileAvatarPreviewUrl) && !profileAvatarRemoveRequested && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleProfileAvatarRemove}
                        disabled={isSavingProfile}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Máx. 5MB. JPG, PNG ou WebP.</p>
                  {profileAvatarError && (
                    <p className="text-sm text-destructive">{profileAvatarError}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  disabled={!canEditProfile}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} disabled={!canEditProfile} placeholder="Seu e-mail" />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input
                  value={profileDepartment}
                  onChange={(e) => setProfileDepartment(e.target.value)}
                  disabled={!canEditProfile}
                  placeholder="Departamento"
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={profilePosition}
                  onChange={(e) => setProfilePosition(e.target.value)}
                  disabled={!canEditProfile}
                  placeholder="Cargo"
                />
              </div>
            </div>
            {(canEditProfile || hasPendingAvatarChange) && (
              <div className="flex justify-end pt-4 border-t border-border mt-6">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  variant="outline"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSavingProfile ? 'Salvando...' : 'Salvar perfil'}
                </Button>
              </div>
            )}
          </div>

          {showBrandSettings && tenant?.id && (
            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-foreground">
                    Branding / Whitelabel
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Personalize a identidade visual da plataforma
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Nome exibido na plataforma"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor primária</Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="color"
                        value={normalizeHex(primaryColorHex) ?? '#2d7a4a'}
                        onChange={(e) => handlePrimaryColorChange(e.target.value)}
                        className="h-10 w-14 rounded-lg border border-border cursor-pointer bg-transparent shrink-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-moz-color-swatch]:rounded-md"
                        aria-label="Selecionar cor primária"
                      />
                      <Input
                        value={primaryColorHex}
                        onChange={(e) => handlePrimaryColorChange(e.target.value)}
                        placeholder="#2d7a4a"
                        className="font-mono w-32"
                      />
                    </div>
                    {primaryColorError && (
                      <p className="text-sm text-destructive">{primaryColorError}</p>
                    )}
                  </div>
                </div>

                <ImageUpload
                  tenantId={tenant.id}
                  pathPrefix="logo"
                  currentUrl={logoUrl}
                  onUploadSuccess={setLogoUrl}
                  onRemove={() => setLogoUrl(undefined)}
                  label="Logotipo"
                />

                <ImageUpload
                  tenantId={tenant.id}
                  pathPrefix="login-cover"
                  currentUrl={loginCoverUrl}
                  onUploadSuccess={setLoginCoverUrl}
                  onRemove={() => setLoginCoverUrl(undefined)}
                  label="Imagem de capa do login"
                />

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={handleSaveBrand}
                    disabled={isSaving || !!primaryColorError}
                    style={{ background: 'var(--gradient-hero)' }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showBrandSettings && tenant?.id && (
            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarClock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-foreground">
                    Periodicidade de avaliações e testes
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Defina intervalos e antecedência das notificações para avaliações 360° e testes DISC
                  </p>
                </div>
              </div>
              <PeriodicityConfig tenantId={tenant.id} />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
