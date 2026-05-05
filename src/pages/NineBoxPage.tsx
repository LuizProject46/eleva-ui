import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useNineBoxMatrixData } from '@/hooks/useNineBoxMatrixData';
import { buildNineBoxPdf, getNineBoxPdfFilename } from '@/lib/nineBoxPdf';
import { cn } from '@/lib/utils';
import {
  getNineBoxQuadrantMeta,
  NINE_BOX_AXIS_LABELS,
  NINE_BOX_PERFORMANCE_ORDER,
  NINE_BOX_POTENTIAL_ORDER,
} from '@/modules/nineBox/nineBoxQuadrants';
import { getNineBoxConfig } from '@/services/nineBoxService';
import type { NineBoxAxisLevel, NineBoxMatrixRow } from '@/types/nineBox';

const MAX_CELL_AVATARS = 5;

interface CellSelection {
  performance: NineBoxAxisLevel;
  potential: NineBoxAxisLevel;
}

async function imageUrlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const absoluteUrl =
      typeof window !== 'undefined' && url.startsWith('/') ? `${window.location.origin}${url}` : url;
    const res = await fetch(absoluteUrl, { mode: 'cors' });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function NineBoxMatrixSkeleton() {
  return (
    <div
      className="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Carregando matriz de desempenho"
    >
      <p className="text-xs text-muted-foreground md:hidden">
        Eixo vertical: competências (alto no topo). Eixo horizontal: objetivos (baixo à esquerda).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5rem)_1fr] gap-x-2 gap-y-2">
        <div className="hidden md:block" aria-hidden />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-full max-w-[6rem] mx-auto" />
          ))}
        </div>
        {NINE_BOX_PERFORMANCE_ORDER.map((perf) => (
          <div key={perf} className="contents">
            <Skeleton className="hidden md:block h-4 w-16 self-center" />
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
          <div className="space-y-2 shrink-0 w-full sm:w-auto">
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function NineBoxPage() {
  const { user, canManageUsers } = useAuth();
  const { brand } = useBrand();
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const tenantId = user?.tenantId;
  const canAccess = canManageUsers();

  const { data: config } = useQuery({
    queryKey: ['nine-box-config', tenantId],
    queryFn: () => getNineBoxConfig(tenantId!),
    enabled: Boolean(tenantId && canAccess),
  });

  const selectedYear = config?.evaluation_year ?? new Date().getFullYear();

  const {
    rows: matrixRows,
    isLoading: matrixLoading,
    error: matrixError,
    refetch: refetchMatrix,
  } = useNineBoxMatrixData({
    tenantId,
    canAccess,
    year: selectedYear,
  });

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

  const filteredListRows = useMemo(() => {
    if (!selectedCell) return matrixRows;
    return matrixRows.filter(
      (row) =>
        row.performance === selectedCell.performance && row.potential === selectedCell.potential
    );
  }, [matrixRows, selectedCell]);

  const toggleCell = (performance: NineBoxAxisLevel, potential: NineBoxAxisLevel) => {
    setSelectedCell((prev) => {
      if (prev?.performance === performance && prev?.potential === potential) return null;
      return { performance, potential };
    });
  };

  const handleExportPdf = () => {
    if (matrixRows.length === 0) return;
    setIsExportingPdf(true);
    void (async () => {
      try {
        const generatedAt = new Date();
        const logoDataUrl = brand.logoUrl ? await imageUrlToDataUrl(brand.logoUrl) : undefined;
        const blob = await buildNineBoxPdf({
          year: selectedYear,
          rows: matrixRows,
          generatedAt,
          branding: {
            companyName: brand.companyName,
            primaryColorHex: brand.primaryColor,
            accentColorHex: brand.accentColor,
            logoDataUrl,
          },
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getNineBoxPdfFilename(selectedYear, generatedAt);
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } finally {
        setIsExportingPdf(false);
      }
    })();
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
            <h1 className="text-xl font-semibold text-foreground md:text-2xl">Matriz Nine-Box</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Eixo horizontal: objetivos. Eixo vertical: competências. Toque em uma célula para
              filtrar a lista.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-muted/40">
                Automático
              </Badge>
              <Badge variant="outline" className="bg-muted/40">
                Ano {selectedYear}
              </Badge>
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleExportPdf}
              disabled={matrixLoading || matrixRows.length === 0 || isExportingPdf}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExportingPdf ? 'Exportando...' : 'Export PDF'}
            </Button>
          </div>
        </div>

        {matrixError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Erro ao carregar a matriz.{' '}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-destructive"
              onClick={() => void refetchMatrix()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : null}

        <section className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Mapa de talentos</h2>

          {matrixLoading ? (
            <NineBoxMatrixSkeleton />
          ) : matrixRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum colaborador com avaliações completas de objetivos e competências.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground md:hidden">
                Eixo vertical: competências (alto no topo). Eixo horizontal: objetivos (baixo à
                esquerda).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5rem)_1fr] gap-x-2 gap-y-2">
                <div className="hidden md:block" aria-hidden />
                <div className="grid grid-cols-3 gap-2">
                  {NINE_BOX_POTENTIAL_ORDER.map((pot) => (
                    <div
                      key={pot}
                      className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground px-1"
                    >
                      Obj. {NINE_BOX_AXIS_LABELS[pot]}
                    </div>
                  ))}
                </div>

                {NINE_BOX_PERFORMANCE_ORDER.map((perf) => (
                  <div key={perf} className="contents">
                    <div className="hidden md:flex items-center">
                      <span className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">
                        Comp. {NINE_BOX_AXIS_LABELS[perf]}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 min-w-0">
                      {NINE_BOX_POTENTIAL_ORDER.map((pot) => {
                        const meta = getNineBoxQuadrantMeta(perf, pot);
                        const cellKey = `${perf}|${pot}`;
                        const cellRows = rowsByCell.get(cellKey) ?? [];
                        const isSelected =
                          selectedCell?.performance === perf && selectedCell?.potential === pot;
                        const visible = cellRows.slice(0, MAX_CELL_AVATARS);
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
                            <TooltipProvider delayDuration={120}>
                              <div className="flex items-center flex-wrap gap-1.5">
                              {visible.map((row) => {
                                const name = row.profiles?.name ?? '—';
                                const objectivesScore = row.objectives_score ?? row.potential_score ?? 0;
                                const competenciesScore =
                                  row.competencies_score ?? row.performance_score ?? 0;
                                return (
                                  <Tooltip key={row.id}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={(event) => event.stopPropagation()}
                                        onKeyDown={(event) => event.stopPropagation()}
                                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                        aria-label={name}
                                      >
                                        <UserAvatar
                                          avatarUrl={row.profiles?.avatar_url}
                                          avatarThumbUrl={row.profiles?.avatar_thumb_url}
                                          name={name}
                                          size="sm"
                                        />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="font-medium">{name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Objetivos {objectivesScore.toFixed(2)} · Competências{' '}
                                        {competenciesScore.toFixed(2)}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                              {overflow > 0 && (
                                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-border/70 bg-background/85 px-2 text-[10px] font-semibold text-muted-foreground">
                                  +{overflow}
                                </span>
                              )}
                              </div>
                            </TooltipProvider>
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

          {matrixLoading ? (
            <NineBoxListSkeleton />
          ) : filteredListRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {selectedCell ? 'Nenhum colaborador nesta célula.' : 'Nenhum colaborador elegível.'}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {filteredListRows.map((evaluation) => {
                const profile = evaluation.profiles;
                const quadrant = getNineBoxQuadrantMeta(evaluation.performance, evaluation.potential);
                const objectivesScore = evaluation.objectives_score ?? evaluation.potential_score ?? 0;
                const competenciesScore =
                  evaluation.competencies_score ?? evaluation.performance_score ?? 0;
                return (
                  <li
                    key={evaluation.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-background/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        avatarUrl={profile?.avatar_url}
                        avatarThumbUrl={profile?.avatar_thumb_url}
                        name={profile?.name ?? 'Colaborador'}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{profile?.name ?? '—'}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {profile?.department ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Objetivos: {objectivesScore.toFixed(2)} · Competências:{' '}
                          {competenciesScore.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'text-xs font-medium rounded-md border px-2 py-1 text-center sm:text-left',
                          quadrant.tier === 'high' && 'bg-primary/10 text-primary border-primary/25',
                          quadrant.tier === 'mid' && 'bg-accent/10 text-foreground border-accent/20',
                          quadrant.tier === 'low' && 'bg-muted text-muted-foreground border-border'
                        )}
                      >
                        {quadrant.label}
                      </span>
                      <span className="text-xs text-muted-foreground rounded-md border border-border px-2 py-1 text-center">
                        Automático
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
