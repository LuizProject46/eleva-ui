import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBrand } from '@/contexts/BrandContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Building2, ArrowLeft, Mail } from 'lucide-react';

function buildRedirectUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/reset-password`;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { brand } = useBrand();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const redirectTo = buildRedirectUrl();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (err) {
        if (err.message.toLowerCase().includes('rate limit') || err.message.toLowerCase().includes('too many')) {
          setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setError('Não foi possível enviar o e-mail. Tente novamente.');
        }
        return;
      }

      setSuccess(true);
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const leftPanelStyle = brand.loginCoverUrl
    ? { backgroundImage: `url(${brand.loginCoverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' as const }
    : { backgroundColor: 'var(--color-primary)' };

  return (
    <div className="min-h-screen flex">
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
              Plataforma completa de gestão de pessoas. Potencialize o desenvolvimento do seu time.
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

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8 flex justify-center">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.companyName}
                className="h-24 object-contain rounded-2xl mb-6"
                loading='lazy'
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
              Esqueceu sua senha?
            </h2>
            <p className="text-muted-foreground">
              {success
                ? 'Verifique seu e-mail'
                : 'Informe seu e-mail e enviaremos um link para redefinir sua senha.'}
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
                <p className="text-sm font-medium">
                  Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha em alguns minutos.
                </p>
                <p className="text-xs mt-2 text-muted-foreground">
                  Verifique também a pasta de spam.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full h-12">
                <Link to="/login" className="flex items-center justify-center gap-2">
                  <ArrowLeft className="w-5 h-5" />
                  Voltar ao login
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-12"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
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
                    Enviando...
                  </span>
                ) : (
                  'Enviar link de recuperação'
                )}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Lembrou da senha?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Voltar ao login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
