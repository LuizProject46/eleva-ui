import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Loader2 } from 'lucide-react';

interface BackofficeTenantRow {
  id: string;
  slug: string;
  company_name: string;
  created_at: string;
  max_users: number | null;
  active_user_count: number;
}

export function BackofficeTenantList() {
  const [tenants, setTenants] = useState<BackofficeTenantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error: rpcError } = await supabase.rpc('get_backoffice_tenants');
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setTenants([]);
      } else {
        setTenants((data ?? []) as BackofficeTenantRow[]);
      }
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground text-sm">
            Empresas cadastradas na plataforma.
          </p>
        </div>
        <Button asChild>
          <Link to="/backoffice/tenants/new">
            <Plus className="h-4 w-4" />
            Novo tenant
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de tenants</CardTitle>
          <CardDescription>
            Nome, data de criação, limite e quantidade de usuários ativos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tenants.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum tenant cadastrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Limite usuários</TableHead>
                  <TableHead className="text-right">Usuários ativos</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.company_name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.slug}</TableCell>
                    <TableCell>{formatDate(row.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {row.max_users == null ? '—' : row.max_users}
                    </TableCell>
                    <TableCell className="text-right">{row.active_user_count}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/backoffice/tenants/${row.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
