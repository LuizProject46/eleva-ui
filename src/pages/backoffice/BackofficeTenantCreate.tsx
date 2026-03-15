import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';

export function BackofficeTenantCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
    user_limit: '',
    slug: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userLimit = parseInt(form.user_limit, 10);
    if (Number.isNaN(userLimit) || userLimit < 0) {
      toast.error('Limite de usuários deve ser um número maior ou igual a zero.');
      return;
    }
    if (!form.company_name.trim()) {
      toast.error('Nome da empresa é obrigatório.');
      return;
    }
    if (!form.admin_name.trim()) {
      toast.error('Nome do administrador é obrigatório.');
      return;
    }
    if (!form.admin_email.trim()) {
      toast.error('E-mail do administrador é obrigatório.');
      return;
    }
    if (!form.admin_password) {
      toast.error('Senha do administrador é obrigatória.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('provision-tenant', {
        body: {
          company_name: form.company_name.trim(),
          admin_name: form.admin_name.trim(),
          admin_email: form.admin_email.trim(),
          admin_password: form.admin_password,
          user_limit: userLimit,
          ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        },
      });

      if (error) {
        toast.error(error.message ?? 'Erro ao criar tenant.');
        return;
      }

      const err = (data as { error?: string })?.error;
      if (err) {
        toast.error(err);
        return;
      }

      const payload = data as { tenant_id?: string };
      toast.success('Tenant criado com sucesso.');
      if (payload?.tenant_id) {
        navigate(`/backoffice/tenants/${payload.tenant_id}`);
      } else {
        navigate('/backoffice/tenants');
      }
    } catch (err) {
      toast.error('Erro ao criar tenant. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/backoffice/tenants" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Novo tenant</h1>
          <p className="text-muted-foreground text-sm">
            Crie uma nova empresa e o primeiro usuário (administrador HR).
          </p>
        </div>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Dados do tenant</CardTitle>
          <CardDescription>
            Preencha os dados da empresa e do administrador. O primeiro usuário será criado com role HR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="company_name">Nome da empresa *</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                placeholder="Ex: Empresa XYZ"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (opcional)</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="Ex: empresa-xyz (gerado automaticamente se vazio)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_limit">Limite de usuários *</Label>
              <Input
                id="user_limit"
                type="number"
                min={0}
                value={form.user_limit}
                onChange={(e) => setForm((p) => ({ ...p, user_limit: e.target.value }))}
                placeholder="0 = ilimitado"
                required
              />
            </div>

            <hr className="border-border" />

            <div className="space-y-2">
              <Label htmlFor="admin_name">Nome do administrador *</Label>
              <Input
                id="admin_name"
                value={form.admin_name}
                onChange={(e) => setForm((p) => ({ ...p, admin_name: e.target.value }))}
                placeholder="Nome completo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_email">E-mail do administrador *</Label>
              <Input
                id="admin_email"
                type="email"
                value={form.admin_email}
                onChange={(e) => setForm((p) => ({ ...p, admin_email: e.target.value }))}
                placeholder="admin@empresa.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_password">Senha do administrador *</Label>
              <Input
                id="admin_password"
                type="password"
                value={form.admin_password}
                onChange={(e) => setForm((p) => ({ ...p, admin_password: e.target.value }))}
                placeholder="Senha de login"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar tenant'
                )}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/backoffice/tenants">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
