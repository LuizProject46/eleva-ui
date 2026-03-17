import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
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
import { ClipboardList, Eye, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CreatePdiDialog } from '@/components/pdi/CreatePdiDialog';
import { UserAvatar } from '@/components/UserAvatar';
import { PdiFilters } from '@/components/filters/PdiFilters';
import type { AsyncSearchOption } from '@/components/async/AsyncSearchCombobox';
import { PDI_TYPE_LABELS } from '@/constants/pdiTypes';

import { usePdis } from '@/modules/pdi/hooks/usePdis';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function PdiListPage() {
  const navigate = useNavigate();
  const { user, canManagePdi } = useAuth();

  const [employeeProfiles, setEmployeeProfiles] = useState<
    Record<string, { name: string; avatar_url?: string | null; avatar_thumb_url?: string | null }>
  >({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const employeeIdFilter = isEmployeeView ? user?.id : filterEmployee?.id ?? undefined;
  const offset = (page - 1) * pageSize;

  const { data, isLoading, isError } = usePdis({
    employeeId: employeeIdFilter ?? undefined,
    status: filterStatus === 'all' ? undefined : filterStatus,
    limit: pageSize,
    offset,
  });

  const pdis = (data?.data ?? []) as Pdi[];
  const totalCount = data?.total ?? 0;

  const employeeIdsInPdis = useMemo(() => [...new Set(pdis.map((p) => p.employee_id))], [pdis]);
  const hasAllProfiles =
    employeeIdsInPdis.length === 0 || employeeIdsInPdis.every((id) => id in employeeProfiles);
  const showTable = !isLoading && (pdis.length === 0 || hasAllProfiles);

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar PDIs');
  }, [isError]);

  useEffect(() => {
    const ids = [...new Set(pdis.map((p) => p.employee_id))];
    if (ids.length === 0) {
      setEmployeeProfiles({});
      return;
    }

    supabase
      .from('profiles')
      .select('id, name, avatar_url, avatar_thumb_url')
      .in('id', ids)
      .then(({ data: profiles }) => {
        const map: Record<string, { name: string; avatar_url?: string | null; avatar_thumb_url?: string | null }> = {};
        (profiles ?? []).forEach((p) => {
          map[p.id] = {
            name: p.name ?? '',
            avatar_url: p.avatar_url ?? null,
            avatar_thumb_url: p.avatar_thumb_url ?? null,
          };
        });
        setEmployeeProfiles(map);
      });
  }, [pdis]);

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

  const handleClearFilters = () => {
    setFilterEmployee(null);
    setFilterStatus('all');
    setPage(1);
  };

  const hasActiveFilters =
    (canCreate && filterEmployee !== null) || filterStatus !== 'all';

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

        <div className="flex flex-wrap items-center justify-between gap-4">
          <PdiFilters
            filterEmployee={filterEmployee}
            filterStatus={filterStatus}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            showEmployeeFilter={canCreate}
            onFilterEmployeeChange={handleFilterEmployeeChange}
            onFilterStatusChange={handleFilterStatusChange}
            onPageSizeChange={handlePageSizeChange}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
            onSearchEmployees={searchEmployees}
          />
        </div>

        <div className="card-elevated overflow-hidden">
          {!showTable ? (
            <div className="overflow-x-auto">
              <div className="w-full min-w-0 rounded-lg border bg-background p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                      <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                      <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                      <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                      <TableHead className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: pageSize }).map((_, i) => (
                      <TableRow key={i} className="animate-pulse">
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
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
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>

                      {canCreate && (
                        <TableHead>Colaborador</TableHead>
                      )}

                      <TableHead>Data de criação</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pdis.map((pdi) => (
                      <TableRow key={pdi.id}>
                        <TableCell className="font-medium">
                          {pdi.title ?? employeeProfiles[pdi.employee_id]?.name ?? 'PDI'}
                        </TableCell>
                        <TableCell>{PDI_TYPE_LABELS[pdi.type] ?? pdi.type}</TableCell>
                        {canCreate && (
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                avatarUrl={employeeProfiles[pdi.employee_id]?.avatar_url}
                                avatarThumbUrl={employeeProfiles[pdi.employee_id]?.avatar_thumb_url}
                                name={employeeProfiles[pdi.employee_id]?.name ?? pdi.employee_id}
                                size="sm"
                              />
                              <Link to={`/employees/${pdi.employee_id}`} className="text-primary hover:underline">
                                {employeeProfiles[pdi.employee_id]?.name ?? pdi.employee_id}
                              </Link>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>{new Date(pdi.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/pdis/${pdi.id}`}>
                                {canCreate ? (
                                  <>
                                    <Pencil className="w-4 h-4 mr-1" />
                                    Editar
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-4 h-4 mr-1" />
                                    Ver
                                  </>
                                )}
                              </Link>
                            </Button>
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
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (page > 1) setPage(page - 1);
                          }}
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
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPage(pageNum);
                                }}
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
                          onClick={(e) => {
                            e.preventDefault();
                            if (page < totalPages) setPage(page + 1);
                          }}
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
        <CreatePdiDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={handleCreateSuccess} />
      )}
    </MainLayout>
  );
}

