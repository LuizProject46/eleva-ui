import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Building2,
  Palette,
  User,
  Save,
  Upload
} from 'lucide-react';
import facholiLogo from '@/assets/facholi-logo.png';

const colorPresets = [
  { name: 'Teal', primary: '168 80% 28%', accent: '24 95% 60%' },
  { name: 'Blue', primary: '220 70% 50%', accent: '35 100% 55%' },
  { name: 'Purple', primary: '270 60% 50%', accent: '330 80% 60%' },
  { name: 'Green', primary: '150 60% 40%', accent: '40 95% 55%' },
  { name: 'Orange', primary: '25 90% 50%', accent: '200 80% 50%' },
];

export default function Settings() {
  const { user } = useAuth();
  const { brand, updateBrand } = useBrand();
  const isHR = user?.role === 'hr';
  
  const [companyName, setCompanyName] = useState(brand.companyName);
  const [selectedPreset, setSelectedPreset] = useState(0);

  const handleSaveBrand = () => {
    const preset = colorPresets[selectedPreset];
    updateBrand({
      companyName,
      primaryColor: preset.primary,
      accentColor: preset.accent,
    });
  };

  return (
    <MainLayout>
      <div className="max-w-4xl animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas preferências e personalize a plataforma
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
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

          {/* Brand Settings (HR only) */}
          {isHR && (
            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-foreground">
                    Marca da Empresa
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
                    <Label>Logotipo</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-16 px-3 rounded-xl bg-white flex items-center justify-center border border-border">
                        <img 
                          src={facholiLogo} 
                          alt={companyName}
                          className="h-10 w-auto object-contain"
                        />
                      </div>
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Enviar Logo
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <Label>Tema de Cores</Label>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {colorPresets.map((preset, index) => (
                      <button
                        key={preset.name}
                        onClick={() => setSelectedPreset(index)}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                          selectedPreset === index
                            ? 'border-foreground shadow-md'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <div 
                          className="w-full h-8 rounded-lg mb-2"
                          style={{ background: `hsl(${preset.primary})` }}
                        />
                        <div 
                          className="w-full h-2 rounded"
                          style={{ background: `hsl(${preset.accent})` }}
                        />
                        <p className="text-xs text-center mt-2 text-muted-foreground">
                          {preset.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button className="gradient-hero" onClick={handleSaveBrand}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
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
