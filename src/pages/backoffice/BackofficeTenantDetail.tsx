import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Pencil, X, Check } from 'lucide-react';

interface TenantDetailRow {
  id: string;
  slug: string;
  company_name: string;
  created_at: string;
  max_users: number | null;
  active_user_count: number;
  admin_name: string | null;
  admin_email: string | null;
}

export function BackofficeTenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenant, setTenant] = useState<TenantDetailRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', slug: '', max_users: '' });

  useEffect(() => {
    if (!tenantId) {
      setError('ID do tenant não informado.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error: rpcError } = await supabase.rpc('get_backoffice_tenant_detail', {
        p_tenant_id: tenantId,
      });
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setTenant(null);
      } else {
        const rows = (data ?? []) as TenantDetailRow[];
        setTenant(rows[0] ?? null);
      }
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function startEditing() {
    if (!tenant) return;
    setEditForm({
      company_name: tenant.company_name,
      slug: tenant.slug,
      max_users: tenant.max_users != null ? String(tenant.max_users) : '',
    });
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  async function saveTenant() {
    if (!tenantId || !tenant) return;
    const companyName = editForm.company_name.trim();
    const slug = editForm.slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!companyName) {
      toast.error('Nome da empresa é obrigatório.');
      return;
    }
    if (!slug) {
      toast.error('Slug é obrigatório.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error('Slug deve conter apenas letras minúsculas, números e hífens.');
      return;
    }
    const maxUsers = editForm.max_users.trim() === '' ? null : parseInt(editForm.max_users, 10);
    if (editForm.max_users.trim() !== '' && (Number.isNaN(maxUsers) || maxUsers < 0)) {
      toast.error('Limite de usuários deve ser um número maior ou igual a zero.');
      return;
    }

    setIsSaving(true);
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        company_name: companyName,
        slug,
        max_users: maxUsers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    setIsSaving(false);
    if (updateError) {
      toast.error(updateError.message ?? 'Erro ao atualizar tenant.');
      return;
    }
    toast.success('Tenant atualizado com sucesso.');
    setIsEditing(false);
    const { data, error: rpcError } = await supabase.rpc('get_backoffice_tenant_detail', {
      p_tenant_id: tenantId,
    });
    if (!rpcError && data?.[0]) {
      setTenant(data[0] as TenantDetailRow);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/backoffice/tenants">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !tenant) {
    return (
      <div className="flex items-center justify-center py-12">
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-muted-foreground">Tenant não encontrado.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/backoffice/tenants" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{tenant.company_name}</h1>
            <p className="text-muted-foreground text-sm">Slug: {tenant.slug}</p>
          </div>
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={startEditing} className="gap-2">
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Empresa</CardTitle>
            <CardDescription>Informações básicas do tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-company_name">Nome da empresa</Label>
                  <Input
                    id="edit-company_name"
                    value={editForm.company_name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, company_name: e.target.value }))
                    }
                    placeholder="Nome da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-slug">Slug</Label>
                  <Input
                    id="edit-slug"
                    value={editForm.slug}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))
                    }
                    placeholder="slug-da-empresa"
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas letras minúsculas, números e hífens. Usado na URL do tenant.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-max_users">Limite de usuários</Label>
                  <Input
                    id="edit-max_users"
                    type="number"
                    min={0}
                    value={editForm.max_users}
                    onChange={(e) => setEditForm((f) => ({ ...f, max_users: e.target.value }))}
                    placeholder="Vazio = ilimitado"
                  />
                </div>
                <p className="text-muted-foreground text-sm">
                  Criado em: {formatDate(tenant.created_at)} · Usuários ativos: {tenant.active_user_count}
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={saveTenant}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  <span className="text-muted-foreground">Nome:</span>{' '}
                  {tenant.company_name}
                </p>
                <p>
                  <span className="text-muted-foreground">Slug:</span> {tenant.slug}
                </p>
                <p>
                  <span className="text-muted-foreground">Criado em:</span>{' '}
                  {formatDate(tenant.created_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Limite de usuários:</span>{' '}
                  {tenant.max_users == null ? 'Ilimitado' : tenant.max_users}
                </p>
                <p>
                  <span className="text-muted-foreground">Usuários ativos:</span>{' '}
                  {tenant.active_user_count}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Administrador (primeiro HR)</CardTitle>
            <CardDescription>Usuário criado no provisionamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tenant.admin_name ?? tenant.admin_email ? (
              <>
                <p>
                  <span className="text-muted-foreground">Nome:</span>{' '}
                  {tenant.admin_name ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">E-mail:</span>{' '}
                  {tenant.admin_email ?? '—'}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhum administrador encontrado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
