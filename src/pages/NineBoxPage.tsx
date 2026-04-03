import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { NineBoxEmployeeChip } from '@/components/nineBox/NineBoxEmployeeChip';
import { NineBoxEvalModal } from '@/components/nineBox/NineBoxEvalModal';
import { MainLayout } from '@/components/layout/MainLayout';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useNineBoxMatrixData } from '@/hooks/useNineBoxMatrixData';
import { filterPeriodsByYear, uniqueYearsDescending } from '@/lib/evaluationPeriods';
import { isEvaluationPeriodCompetencyNineBox } from '@/lib/nineBoxCompetencyPeriod';
import { cn } from '@/lib/utils';
import {
  getNineBoxQuadrantMeta,
  NINE_BOX_AXIS_LABELS,
  NINE_BOX_PERFORMANCE_ORDER,
  NINE_BOX_POTENTIAL_ORDER,
} from '@/modules/nineBox/nineBoxQuadrants';
import { supabase } from '@/lib/supabase';
import { listNineBoxEvaluationPeriods } from '@/services/nineBoxService';
import type { NineBoxAxisLevel, NineBoxMatrixRow } from '@/types/nineBox';

const MAX_CHIPS = 4;

interface EligibleProfile {
  id: string;
  name: string;
  department: string | null;
  avatar_url: string | null;
  avatar_thumb_url: string | null;
}

interface CellSelection {
  performance: NineBoxAxisLevel;
  potential: NineBoxAxisLevel;
}

function NineBoxMatrixSkeleton() {
  return (
    <div
      className="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Carregando mapa de talentos"
    >
      <p className="text-xs text-muted-foreground md:hidden">
        Eixo vertical: desempenho (alto no topo). Eixo horizontal: potencial (baixo à esquerda).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,4.5rem)_1fr] gap-x-2 gap-y-2">
        <div className="hidden md:block" aria-hidden />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-full max-w-[4rem] mx-auto" />
          ))}
        </div>
        {NINE_BOX_PERFORMANCE_ORDER.map((perf) => (
          <div key={perf} className="contents">
            <Skeleton className="hidden md:block h-4 w-14 self-center" />
            <div className="grid grid-cols-3 gap-2 min-w-0">
              {NINE_BOX_POTENTIAL_ORDER.map((pot) => (
                <Skeleton
                  key={`${perf}-${pot}`}
                  className="min-h-[100px] sm:min-h-[120px] rounded-lg"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NineBoxListSkeleton() {
  return (
    <ul
      className="divide-y divide-border rounded-lg border border-border overflow-hidden"
      aria-busy="true"
      aria-label="Carregando colaboradores"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-background/50"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-2 min-w-0 flex-1">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-28 max-w-full" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md sm:w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function NineBoxPage() {
  const { user, canManageUsers, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('legacy');
  const [nineBoxPeriodYear, setNineBoxPeriodYear] = useState<number>(() => new Date().getFullYear());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalEmployeeId, setModalEmployeeId] = useState<string | null>(null);
  const [modalEmployeeName, setModalEmployeeName] = useState<string | null>(null);

  const tenantId = user?.tenantId;
  const canAccess = canManageUsers();
  const isManagerRole = isManager();

  const invalidateNineBox = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['nine-box-matrix-data', tenantId] });
    void queryClient.invalidateQueries({ queryKey: ['nine-box-periods', tenantId] });
    void queryClient.invalidateQueries({ queryKey: ['nine-box-eligible', tenantId, user?.id, isManagerRole] });
  }, [queryClient, tenantId, user?.id, isManagerRole]);

  const {
    data: periods = [],
    isLoading: periodsLoading,
  } = useQuery({
    queryKey: ['nine-box-periods', tenantId],
    queryFn: () => listNineBoxEvaluationPeriods(tenantId!),
    enabled: Boolean(tenantId && canAccess),
  });

  const periodYears = useMemo(() => uniqueYearsDescending(periods), [periods]);
  const periodsInNineBoxYear = useMemo(
    () => filterPeriodsByYear(periods, nineBoxPeriodYear),
    [periods, nineBoxPeriodYear]
  );

  useEffect(() => {
    if (periodYears.length === 0) return;
    setNineBoxPeriodYear((y) => (periodYears.includes(y) ? y : periodYears[0]));
  }, [periodYears]);

  const handleNineBoxPeriodYearChange = useCallback(
    (value: string) => {
      const year = Number(value);
      if (!Number.isFinite(year)) return;
      setNineBoxPeriodYear(year);
      setSelectedPeriodId((prev) => {
        if (prev === 'legacy') return 'legacy';
        const row = periods.find((p) => p.id === prev);
        if (row != null && row.year === year) return prev;
        return 'legacy';
      });
    },
    [periods]
  );

  const periodIdForMode = selectedPeriodId === 'legacy' ? null : selectedPeriodId;

  const {
    rows: matrixRows,
    mode,
    periodName,
    isLoading: matrixLoading,
    error: matrixError,
    refetch: refetchMatrix,
  } = useNineBoxMatrixData({
    tenantId,
    canAccess,
    periodId: periodIdForMode,
  });

  const { data: eligibleProfiles = [], isLoading: eligibleLoading } = useQuery({
    queryKey: ['nine-box-eligible', tenantId, user?.id, isManagerRole],
    queryFn: async (): Promise<EligibleProfile[]> => {
      if (!tenantId || !user?.id) return [];
      let query = supabase
        .from('profiles')
        .select('id, name, department, avatar_url, avatar_thumb_url')
        .eq('tenant_id', tenantId)
        .neq('id', user.id)
        .eq('is_active', true)
        .order('name');
      if (isManagerRole) {
        query = query.eq('manager_id', user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as EligibleProfile[];
    },
    enabled: Boolean(tenantId && user?.id && canAccess),
  });

  const evalByEmployeeId = useMemo(() => {
    const m = new Map<string, NineBoxMatrixRow>();
    for (const row of matrixRows) {
      m.set(row.employee_id, row);
    }
    return m;
  }, [matrixRows]);

  const rowsByCell = useMemo(() => {
    const map = new Map<string, NineBoxMatrixRow[]>();
    for (const perf of NINE_BOX_PERFORMANCE_ORDER) {
      for (const pot of NINE_BOX_POTENTIAL_ORDER) {
        map.set(`${perf}|${pot}`, []);
      }
    }
    for (const row of matrixRows) {
      const key = `${row.performance}|${row.potential}`;
      const list = map.get(key);
      if (list) list.push(row);
    }
    return map;
  }, [matrixRows]);

  const listRows = useMemo(() => {
    return eligibleProfiles.map((p) => {
      const ev = evalByEmployeeId.get(p.id);
      return { profile: p, evaluation: ev ?? null };
    });
  }, [eligibleProfiles, evalByEmployeeId]);

  const filteredListRows = useMemo(() => {
    if (!selectedCell) return listRows;
    return listRows.filter(
      (r) =>
        r.evaluation &&
        r.evaluation.performance === selectedCell.performance &&
        r.evaluation.potential === selectedCell.potential
    );
  }, [listRows, selectedCell]);

  const isCompetencyMode = mode === 'competency';

  const modeLabel = isCompetencyMode
    ? `Competências (2º período${periodName ? `: ${periodName}` : ''})`
    : 'Manual (legado)';

  const openCreateModal = (employeeId: string | null, employeeName: string | null) => {
    setModalMode('create');
    setModalEmployeeId(employeeId);
    setModalEmployeeName(employeeName);
    setModalOpen(true);
  };

  const openEditModal = (employeeId: string, employeeName: string) => {
    setModalMode('edit');
    setModalEmployeeId(employeeId);
    setModalEmployeeName(employeeName);
    setModalOpen(true);
  };

  const toggleCell = (performance: NineBoxAxisLevel, potential: NineBoxAxisLevel) => {
    setSelectedCell((prev) => {
      if (prev?.performance === performance && prev?.potential === potential) return null;
      return { performance, potential };
    });
  };

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!tenantId) {
    return (
      <MainLayout>
        <p className="text-sm text-muted-foreground p-4 md:p-8">
          Tenant não disponível. Não é possível carregar a matriz.
        </p>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground md:text-2xl">Matriz 9Box</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Desempenho (vertical) e potencial (horizontal). Toque em uma célula para filtrar a lista.
            </p>
            <div className="mt-2">
              <Badge variant="outline" className="bg-muted/40">
                {modeLabel}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {periodYears.length > 0 ? (
              <Select
                value={String(nineBoxPeriodYear)}
                onValueChange={handleNineBoxPeriodYearChange}
                disabled={periodsLoading}
              >
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {periodYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId} disabled={periodsLoading}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy">Visualização atual (manual)</SelectItem>
                {periodsInNineBoxYear.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.name}
                    {isEvaluationPeriodCompetencyNineBox(period) ? ' · Competências' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!isCompetencyMode ? (
              <Button
                type="button"
                className="shrink-0"
                onClick={() => openCreateModal(null, null)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova avaliação
              </Button>
            ) : null}
          </div>
        </div>

        {matrixError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Erro ao carregar a matriz.{' '}
            <Button type="button" variant="link" className="h-auto p-0 text-destructive" onClick={() => void refetchMatrix()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        <section className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Mapa de talentos</h2>

          {matrixLoading ? (
            <NineBoxMatrixSkeleton />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground md:hidden">
                Eixo vertical: desempenho (alto no topo). Eixo horizontal: potencial (baixo à esquerda).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,4.5rem)_1fr] gap-x-2 gap-y-2">
                <div className="hidden md:block" aria-hidden />
                <div className="grid grid-cols-3 gap-2">
                  {NINE_BOX_POTENTIAL_ORDER.map((pot) => (
                    <div
                      key={pot}
                      className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground px-1"
                    >
                      Pot. {NINE_BOX_AXIS_LABELS[pot]}
                    </div>
                  ))}
                </div>

                {NINE_BOX_PERFORMANCE_ORDER.map((perf) => (
                  <div key={perf} className="contents">
                    <div className="hidden md:flex items-center">
                      <span className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">
                        Des. {NINE_BOX_AXIS_LABELS[perf]}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 min-w-0">
                      {NINE_BOX_POTENTIAL_ORDER.map((pot) => {
                        const meta = getNineBoxQuadrantMeta(perf, pot);
                        const cellKey = `${perf}|${pot}`;
                        const cellRows = rowsByCell.get(cellKey) ?? [];
                        const isSelected =
                          selectedCell?.performance === perf && selectedCell?.potential === pot;
                        const visible = cellRows.slice(0, MAX_CHIPS);
                        const overflow = cellRows.length - visible.length;

                        return (
                          <div
                            key={cellKey}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleCell(perf, pot)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleCell(perf, pot);
                              }
                            }}
                            className={cn(
                              'rounded-lg border p-2 text-left min-h-[100px] sm:min-h-[120px] transition-shadow cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              meta.cellClassName,
                              isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                            )}
                          >
                            <p className="text-[10px] sm:text-xs font-semibold text-foreground leading-tight mb-2 line-clamp-2">
                              {meta.label}
                            </p>
                            <div className="flex flex-col gap-1">
                              {visible.map((row) => {
                                const name = row.profiles?.name ?? '—';
                                return (
                                  <NineBoxEmployeeChip
                                    key={row.id}
                                    name={name}
                                    avatarUrl={row.profiles?.avatar_url}
                                    avatarThumbUrl={row.profiles?.avatar_thumb_url}
                                    tooltipTitle={
                                      isCompetencyMode
                                        ? `Desempenho ${row.performance_score ?? 0}% · Potencial ${row.potential_score ?? 0}%`
                                        : undefined
                                    }
                                    onClick={
                                      isCompetencyMode
                                        ? undefined
                                        : (e) => {
                                            e.stopPropagation();
                                            openEditModal(row.employee_id, name);
                                          }
                                    }
                                  />
                                );
                              })}
                              {overflow > 0 && (
                                <span className="text-[10px] text-muted-foreground font-medium px-1">
                                  +{overflow} mais
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Colaboradores
              {selectedCell ? (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · filtro: {getNineBoxQuadrantMeta(selectedCell.performance, selectedCell.potential).label}
                </span>
              ) : null}
            </h2>
            {selectedCell ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCell(null)}>
                Limpar filtro
              </Button>
            ) : null}
          </div>

          {eligibleLoading ? (
            <NineBoxListSkeleton />
          ) : filteredListRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {selectedCell ? 'Nenhum colaborador nesta célula.' : 'Nenhum colaborador elegível.'}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {filteredListRows.map(({ profile, evaluation }) => {
                const quadrant = evaluation
                  ? getNineBoxQuadrantMeta(evaluation.performance, evaluation.potential)
                  : null;
                return (
                  <li
                    key={profile.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-background/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        avatarUrl={profile.avatar_url}
                        avatarThumbUrl={profile.avatar_thumb_url}
                        name={profile.name}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{profile.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {profile.department ?? '—'}
                        </p>
                        {isCompetencyMode && evaluation ? (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            Desempenho: {evaluation.performance_score ?? 0}% · Potencial:{' '}
                            {evaluation.potential_score ?? 0}%
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'text-xs font-medium rounded-md border px-2 py-1 text-center sm:text-left',
                          quadrant
                            ? cn(
                                quadrant.tier === 'high' && 'bg-primary/10 text-primary border-primary/25',
                                quadrant.tier === 'mid' && 'bg-accent/10 text-foreground border-accent/20',
                                quadrant.tier === 'low' && 'bg-muted text-muted-foreground border-border'
                              )
                            : 'bg-muted/50 text-muted-foreground border-transparent'
                        )}
                      >
                        {quadrant?.label ?? 'Sem posição'}
                      </span>
                      {isCompetencyMode ? (
                        <span className="text-xs text-muted-foreground rounded-md border border-border px-2 py-1 text-center">
                          Automático
                        </span>
                      ) : evaluation ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(profile.id, profile.name)}
                        >
                          Editar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openCreateModal(profile.id, profile.name)}
                        >
                          Adicionar avaliação
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <NineBoxEvalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tenantId={tenantId}
        currentUserId={user!.id}
        isManager={isManagerRole}
        managerUserId={user!.id}
        mode={modalMode}
        employeeId={modalEmployeeId}
        employeeName={modalEmployeeName}
        onSuccess={invalidateNineBox}
      />
    </MainLayout>
  );
}
