import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Empresa</CardTitle>
            <CardDescription>Informações básicas do tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
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
