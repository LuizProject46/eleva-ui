/**
 * PDI list grid: performance notes
 * - List + progress use React Query with staleTime 60s / gcTime 5m to avoid duplicate fetches on focus.
 * - Profile fetch key is derived from sorted employee ids on the current page (deps align with `pdis`).
 * - Rows are memoized (`PdiListTableRow`); PDF download still updates all rows’ disabled state when any download runs.
 * - Validate with React DevTools Profiler (e.g. open dialog vs. idle row renders).
 */
import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { usePdiPermissions } from '@/modules/pdi/usePdiPermissions';
import { supabase } from '@/lib/supabase';
import type { PdiListRow } from '@/types/pdi';
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
import { ClipboardList, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CreatePdiDialog } from '@/components/pdi/CreatePdiDialog';
import { PdiFilters } from '@/components/filters/PdiFilters';
import type { AsyncSearchOption } from '@/components/async/AsyncSearchCombobox';

import { usePdis } from '@/modules/pdi/hooks/usePdis';
import {
  usePdiListProgress,
  PDI_LIST_PROGRESS_DEFAULT,
} from '@/modules/pdi/hooks/usePdiListProgress';
import { PdiListTableRow } from '@/modules/pdi/components/PdiListTableRow';
import { usePdiPdfDownload } from '@/modules/pdi/hooks/usePdiPdfDownload';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function PdiListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { downloadPdiPdf, downloadingPdiId } = usePdiPdfDownload();
  const { listMode, canCreatePdi } = usePdiPermissions();

  const [employeeProfiles, setEmployeeProfiles] = useState<
    Record<string, { name: string; avatar_url?: string | null; avatar_thumb_url?: string | null }>
  >({});
  const [isProfilesLoading, setIsProfilesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<AsyncSearchOption | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const canCreate = canCreatePdi;
  const showEmployeeFilter = listMode === 'hr' || listMode === 'manager';
  const showEmployeeColumn = listMode === 'hr' || listMode === 'manager';
  const collaboratorDefaultStatusSet = useRef(false);

  useEffect(() => {
    if (listMode === 'collaborator' && !collaboratorDefaultStatusSet.current) {
      collaboratorDefaultStatusSet.current = true;
      setFilterStatus('active');
    }
  }, [listMode]);

  const employeeIdFilter =
    listMode === 'collaborator'
      ? user?.id
      : filterEmployee?.id ?? undefined;
  const offset = (page - 1) * pageSize;

  const { data, isLoading, isError } = usePdis({
    employeeId: employeeIdFilter ?? undefined,
    status: filterStatus === 'all' ? undefined : filterStatus,
    limit: pageSize,
    offset,
  });

  const pdis = useMemo(() => data?.data ?? [], [data?.data]);

  const employeeIdsFetchKey = useMemo(() => {
    if (pdis.length === 0) return '';
    return [...new Set(pdis.map((p) => p.employee_id))].sort().join(',');
  }, [pdis]);

  const totalCount = data?.total ?? 0;
  const pdiIdsForProgress = useMemo(() => pdis.map((p) => p.id), [pdis]);
  const progressByPdi = usePdiListProgress(pdiIdsForProgress);

  const isAnyPdfDownloadActive = downloadingPdiId !== null;
  const isEmployeeColumnSkeleton = showEmployeeColumn && isProfilesLoading;

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar PDIs');
  }, [isError]);

  useEffect(() => {
    if (!employeeIdsFetchKey) {
      setEmployeeProfiles((prev) =>
        Object.keys(prev).length === 0 ? prev : {}
      );
      setIsProfilesLoading(false);
      return;
    }

    setIsProfilesLoading(true);
    setEmployeeProfiles({});

    const ids = employeeIdsFetchKey.split(',');
    let cancelled = false;

    supabase
      .from('profiles')
      .select('id, name, avatar_url, avatar_thumb_url')
      .in('id', ids)
      .then(({ data: profiles }) => {
        if (cancelled) return;
        const map: Record<
          string,
          { name: string; avatar_url?: string | null; avatar_thumb_url?: string | null }
        > = {};
        (profiles ?? []).forEach((p) => {
          map[p.id] = {
            name: p.name ?? '',
            avatar_url: p.avatar_url ?? null,
            avatar_thumb_url: p.avatar_thumb_url ?? null,
          };
        });
        setEmployeeProfiles(map);
        setIsProfilesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeIdsFetchKey]);

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
      if (listMode === 'manager' && user?.id) {
        q = q.eq('manager_id', user.id);
      }
      const { data: rows, error } = await q;
      if (error) return [];
      return (rows ?? []).map((r) => ({ id: r.id, label: r.name ?? '' }));
    },
    [user?.tenantId, user?.id, listMode]
  );

  const handleCreateSuccess = useCallback(
    (pdiId: string) => {
      setCreateDialogOpen(false);
      toast.success('PDI criado.');
      navigate(`/pdis/${pdiId}`);
    },
    [navigate]
  );

  const handleFilterEmployeeChange = useCallback((value: AsyncSearchOption | null) => {
    setFilterEmployee(value);
    setPage(1);
  }, []);

  const handleFilterStatusChange = useCallback((value: string) => {
    setFilterStatus(value);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterEmployee(null);
    setFilterStatus('all');
    setPage(1);
  }, []);

  const hasActiveFilters =
    (showEmployeeFilter && filterEmployee !== null) || filterStatus !== 'all';

  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(Number(value));
    setPage(1);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const onDownloadPdf = useCallback(
    (pdiId: string) => {
      void downloadPdiPdf(pdiId);
    },
    [downloadPdiPdf]
  );

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalCount);

  const visiblePageNumbers = useMemo(() => {
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
    const len = Math.max(0, end - start + 1);
    return Array.from({ length: len }, (_, i) => start + i);
  }, [page, totalPages]);

  const handlePaginationPrevious = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setPage((p) => (p > 1 ? p - 1 : p));
  }, []);

  const handlePaginationNext = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setPage((p) => (p < totalPages ? p + 1 : p));
    },
    [totalPages]
  );

  const handlePageNumberClick = useCallback(
    (pageNum: number) => (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setPage(pageNum);
    },
    []
  );

  return (
    <MainLayout>
      <div className="p-4 md:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Planos de Desenvolvimento Individual
          </h1>
          {canCreate && (
            <Button type="button" onClick={handleOpenCreate}>
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
            showEmployeeFilter={showEmployeeFilter}
            onFilterEmployeeChange={handleFilterEmployeeChange}
            onFilterStatusChange={handleFilterStatusChange}
            onPageSizeChange={handlePageSizeChange}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
            onSearchEmployees={searchEmployees}
          />
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
                      <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                      <TableHead><Skeleton className="h-4 w-14" /></TableHead>
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
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-[46px] w-[46px] rounded-full mx-auto sm:mx-0" /></TableCell>
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
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap">Andamento</TableHead>
                      {showEmployeeColumn && (
                        <TableHead>Colaborador</TableHead>
                      )}
                      <TableHead>Data de criação</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap text-right min-w-[140px]">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pdis.map((pdi: PdiListRow) => (
                      <PdiListTableRow
                        key={pdi.id}
                        pdi={pdi}
                        progressEntry={
                          progressByPdi.data?.[pdi.id] ??
                          PDI_LIST_PROGRESS_DEFAULT
                        }
                        isProgressLoading={progressByPdi.isLoading}
                        showEmployeeColumn={showEmployeeColumn}
                        employeeProfile={employeeProfiles[pdi.employee_id]}
                        isEmployeeColumnSkeleton={isEmployeeColumnSkeleton}
                        canCreatePdi={canCreatePdi}
                        isRowDownloadingPdf={downloadingPdiId === pdi.id}
                        isAnyPdfDownloadActive={isAnyPdfDownloadActive}
                        onDownloadPdf={onDownloadPdf}
                      />
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
                          onClick={handlePaginationPrevious}
                          aria-disabled={page <= 1}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {visiblePageNumbers.map((pageNum) => (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href="#"
                            onClick={handlePageNumberClick(pageNum)}
                            isActive={page === pageNum}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={handlePaginationNext}
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
