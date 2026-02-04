import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, User, Save } from 'lucide-react';
import { toast } from 'sonner';
import { isHexColor, normalizeHex } from '@/lib/branding';
import { ImageUpload } from '@/components/settings/ImageUpload';
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
  const { user, isHR } = useAuth();
  const { brand, updateBrand } = useBrand();
  const { tenant, refetchTenant } = useTenant();
  const showBrandSettings = isHR();

  const [companyName, setCompanyName] = useState(brand.companyName);
  const [primaryColorHex, setPrimaryColorHex] = useState(brand.primaryColor);
  const [primaryColorError, setPrimaryColorError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(brand.logoUrl);
  const [loginCoverUrl, setLoginCoverUrl] = useState<string | undefined>(brand.loginCoverUrl);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCompanyName(brand.companyName);
    setPrimaryColorHex(brand.primaryColor);
    setLogoUrl(brand.logoUrl);
    setLoginCoverUrl(brand.loginCoverUrl);
  }, [brand.companyName, brand.primaryColor, brand.logoUrl, brand.loginCoverUrl]);

  const handlePrimaryColorChange = (value: string) => {
    setPrimaryColorHex(value);
    if (value.trim() && !isHexColor(value)) {
      setPrimaryColorError('Cor inválida. Use hex (ex: #2d7a4a).');
    } else {
      setPrimaryColorError(null);
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={user?.name} disabled />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={user?.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input value={user?.department} disabled />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={user?.position} disabled />
              </div>
            </div>
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
        </div>
      </div>
    </MainLayout>
  );
}
