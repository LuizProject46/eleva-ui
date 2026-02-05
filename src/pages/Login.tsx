import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Building2, ArrowRight, Eye, EyeOff } from 'lucide-react';

function getAuthErrorMessage(error: { message?: string; status?: number }): string {
  const msg = error?.message?.toLowerCase() ?? '';
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de fazer login.';
  }
  if (msg.includes('too many requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  return 'Erro ao fazer login. Verifique suas credenciais e tente novamente.';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(getAuthErrorMessage(err as { message?: string; status?: number }));
    } finally {
      setIsLoading(false);
    }
  };

  const leftPanelStyle = brand.loginCoverUrl
    ? { backgroundImage: `url(${brand.loginCoverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' as const }
    : { backgroundColor: 'var(--color-primary)' };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 min-h-screen relative overflow-hidden"
        style={leftPanelStyle}
      >
        {!brand.loginCoverUrl && (
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        )}

        <div className="relative z-10 flex flex-col justify-center px-16 text-white bg-black/70 w-full">
          <div className="mb-12">
            <p className="text-xl text-white/80 leading-relaxed font-bold">
              Plataforma completa de gestão de pessoas.
              Potencialize o desenvolvimento do seu time.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Onboarding Inteligente</h3>
                <p className="text-sm text-white/70">Acompanhe cada etapa da integração</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Cultura de Alta Performance</h3>
                <p className="text-sm text-white/70">Avaliações e mentorias contínuas</p>
              </div>
            </div>
          </div>
        </div>

        {!brand.loginCoverUrl && (
          <>
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
            <div className="absolute top-20 -right-16 w-64 h-64 rounded-full bg-white/5" />
          </>
        )}
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8  flex justify-center">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.companyName}
                className="h-24 object-contain rounded-2xl mb-6"
              />
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">{brand.companyName.charAt(0)}</span>
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground">
                  {brand.companyName}
                </h1>
              </>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">
              Bem-vindo de volta
            </h2>
            <p className="text-muted-foreground">
              Entre com suas credenciais para acessar o portal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 gradient-hero hover:opacity-90 transition-opacity font-semibold"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Entrar
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Esqueceu sua senha?
            <a href="/forgot-password" className="text-primary hover:underline font-medium">Recuperar acesso</a>
          </p>
        </div>
      </div>
    </div>
  );
}
