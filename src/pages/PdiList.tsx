import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { listPdis } from '@/services/pdiService';
import type { Pdi } from '@/types/pdi';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Plus, Eye, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { CreatePdiDialog } from '@/components/pdi/CreatePdiDialog';
import { UserAvatar } from '@/components/UserAvatar';
import { AsyncSearchCombobox } from '@/components/async/AsyncSearchCombobox';
import type { AsyncSearchOption } from '@/components/async/AsyncSearchCombobox';
import { PDI_STATUS_LABELS } from '@/lib/pdiLifecycle';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function PdiList() {
  const navigate = useNavigate();
  const { user, canManagePdi } = useAuth();
  const [pdis, setPdis] = useState<Pdi[]>([]);
  const [employeeProfiles, setEmployeeProfiles] = useState<
    Record<string, { name: string; avatar_url?: string | null; avatar_thumb_url?: string | null }>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<AsyncSearchOption | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const canCreate = canManagePdi();
  const isEmployeeView = !canCreate;
  const initialEmployeeFilterSet = useRef(false);

  useEffect(() => {
    if (isEmployeeView && !initialEmployeeFilterSet.current) {
      initialEmployeeFilterSet.current = true;
      setFilterStatus('active');
    }
  }, [isEmployeeView]);

  const searchEmployees = useCallback(
    async (query: string): Promise<AsyncSearchOption[]> => {
      if (!user?.tenantId) return [];
      let q = supabase
        .from('profiles')
        .select('id, name')
        .eq('tenant_id', user.tenantId)
        .eq('is_active', true)
        .order('name')
        .limit(20);
      if (query.trim()) {
        q = q.ilike('name', `%${query.trim()}%`);
      }
      if (user?.role === 'manager' && user?.id) {
        q = q.eq('manager_id', user.id);
      }
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map((r) => ({ id: r.id, label: r.name ?? '' }));
    },
    [user?.tenantId, user?.id, user?.role]
  );

  const fetchPdis = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const employeeIdFilter = isEmployeeView ? user.id : filterEmployee?.id ?? undefined;
      const offset = (page - 1) * pageSize;
      const { data, total } = await listPdis({
        employeeId: employeeIdFilter,
        status: filterStatus === 'all' ? undefined : filterStatus,
        limit: pageSize,
        offset,
      });
      setPdis(data);
      setTotalCount(total);
      const ids = [...new Set(data.map((p) => p.employee_id))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, avatar_thumb_url')
          .in('id', ids);
        const map: Record<string, { name: string; avatar_url?: string | null; avatar_thumb_url?: string | null }> = {};
        (profiles ?? []).forEach((p) => {
          map[p.id] = {
            name: p.name ?? '',
            avatar_url: p.avatar_url ?? null,
            avatar_thumb_url: p.avatar_thumb_url ?? null,
          };
        });
        setEmployeeProfiles(map);
      } else {
        setEmployeeProfiles({});
      }
    } catch {
      toast.error('Erro ao carregar PDIs');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isEmployeeView, filterEmployee?.id, page, pageSize, filterStatus]);

  useEffect(() => {
    fetchPdis();
  }, [fetchPdis]);

  const handleCreateSuccess = (pdiId: string) => {
    setCreateDialogOpen(false);
    toast.success('PDI criado.');
    navigate(`/pdis/${pdiId}`);
  };

  const handleFilterEmployeeChange = (value: AsyncSearchOption | null) => {
    setFilterEmployee(value);
    setPage(1);
  };

  const handleFilterStatusChange = (value: string) => {
    setFilterStatus(value);
    setPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalCount);

  return (
    <MainLayout>
      <div className="p-4 md:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Planos de Desenvolvimento Individual
          </h1>
          {canCreate && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo PDI
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {canCreate && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Colaborador</span>
              <AsyncSearchCombobox
                value={filterEmployee}
                onValueChange={handleFilterEmployeeChange}
                onSearch={searchEmployees}
                placeholder="Todos"
                searchPlaceholder="Buscar por nome..."
                emptyMessage="Nenhum encontrado."
                clearLabel="Limpar"
                className="w-[200px]"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select value={filterStatus} onValueChange={handleFilterStatusChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(PDI_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          {isLoading ? (
            <div className="overflow-x-auto">
              <div className="w-full min-w-0 rounded-lg border bg-background p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                      <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                      <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                      <TableHead className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: pageSize }).map((_, i) => (
                      <TableRow key={i} className="animate-pulse">
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : pdis.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum PDI encontrado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data de criação</TableHead>
                      <TableHead className="w-[120px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pdis.map((pdi) => (
                      <TableRow key={pdi.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              avatarUrl={employeeProfiles[pdi.employee_id]?.avatar_url}
                              avatarThumbUrl={employeeProfiles[pdi.employee_id]?.avatar_thumb_url}
                              name={employeeProfiles[pdi.employee_id]?.name ?? pdi.employee_id}
                              size="sm"
                            />
                            <Link to={`/employees/${pdi.employee_id}`} className="font-medium text-primary hover:underline">
                              {employeeProfiles[pdi.employee_id]?.name ?? pdi.employee_id}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell>{PDI_STATUS_LABELS[pdi.status as keyof typeof PDI_STATUS_LABELS] ?? pdi.status}</TableCell>
                        <TableCell>
                          {new Date(pdi.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/pdis/${pdi.id}`}>
                                <Eye className="w-4 h-4 mr-1" />
                                Ver
                              </Link>
                            </Button>
                            {canCreate && (
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/pdis/${pdi.id}`}>
                                  <Pencil className="w-4 h-4 mr-1" />
                                  Editar
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {startRow}–{endRow} de {totalCount}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Por página</span>
                    <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="h-9 w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                          aria-disabled={page <= 1}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {(() => {
                        const maxVisible = 5;
                        let start = 1;
                        let end = Math.min(maxVisible, totalPages);
                        if (totalPages > maxVisible) {
                          if (page > totalPages - 2) {
                            start = totalPages - 4;
                            end = totalPages;
                          } else if (page > 2) {
                            start = page - 2;
                            end = page + 2;
                          }
                        }
                        return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => {
                          const pageNum = start + i;
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => { e.preventDefault(); setPage(pageNum); }}
                                isActive={page === pageNum}
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        });
                      })()}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
                          aria-disabled={page >= totalPages}
                          className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {canCreate && (
        <CreatePdiDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleCreateSuccess}
        />
      )}
    </MainLayout>
  );
}
