import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { CompetenciesList, type AssignmentWithCompetency } from '@/components/evaluation/competencies/CompetenciesList';
import { CompetencyEvaluationForm } from '@/components/evaluation/competencies/CompetencyEvaluationForm';
import { CompetencyForm } from '@/components/evaluation/competencies/CompetencyForm';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { toast } from '@/hooks/use-toast';
import {
  areAllCatalogCompetenciesRated,
  decimalToPercent,
  getAssignmentsWeightPercentTotal,
  parseWeightPercent,
  percentToDecimal,
  rebalanceWeightsProportionally,
} from '@/lib/performanceCompetencyValidation';
import { computeCompetenciesWeightedAverage } from '@/lib/performanceCompetencyScoring';
import { cn } from '@/lib/utils';
import {
  searchObjectivesEmployees,
  type ObjectivesEmployeeSearchRow,
} from '@/services/objectivesEmployeeSearchService';
import {
  listEvaluationCompetencies,
  listPerformanceCompetencyAssignments,
  listPerformanceCompetencyEvaluations,
  insertPerformanceCompetencyAssignment,
  updatePerformanceCompetencyAssignment,
  upsertPerformanceCompetencyEvaluation,
} from '@/services/performanceCompetenciesService';
import type {
  EvaluationCompetencyRow,
  PerformanceCompetencyAssignmentRow,
  PerformanceCompetencyEvaluationRow,
} from '@/types/performanceCompetency';

type ProfileOption = ObjectivesEmployeeSearchRow;

const EMPLOYEE_LIST_LIMIT = 10;
const EMPLOYEE_SEARCH_DEBOUNCE_MS = 350;
const MAX_COMPETENCY_ASSIGNMENTS = 5;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function formatProfileOptionLabel(profile: ProfileOption): string {
  return profile.department ? `${profile.name} · ${profile.department}` : profile.name;
}

function distributePercentEvenly(totalPercent: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((totalPercent / count) * 100) / 100;
  const values = Array.from({ length: count }, () => base);
  const currentTotal = values.reduce((sum, value) => sum + value, 0);
  let remainder = Math.round((totalPercent - currentTotal) * 100);
  let index = 0;
  while (remainder > 0) {
    values[index] += 0.01;
    remainder -= 1;
    index = (index + 1) % count;
  }
  return values;
}

function EmployeeSearchCombobox({
  comboboxId,
  selectedId,
  selectedLabel,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchLoading,
  searchPlaceholder = 'Nome, e-mail, setor ou cargo…',
  onSelect,
  placeholder = 'Selecionar colaborador…',
}: {
  comboboxId: string;
  selectedId: string;
  selectedLabel: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: ProfileOption[];
  searchLoading: boolean;
  searchPlaceholder?: string;
  onSelect: (id: string, option: ProfileOption | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayValue = selectedLabel || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          id={comboboxId}
          className="w-full justify-between font-normal hover:bg-muted/30 transition-colors hover:text-accent"
        >
          <span className="truncate text-left">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={searchQuery}
            onValueChange={onSearchQueryChange}
          />
          <CommandList>
            {searchLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : (
              <>
                <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                <CommandGroup>
                  {selectedId ? (
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        onSelect('', null);
                        setOpen(false);
                      }}
                    >
                      Limpar seleção
                    </CommandItem>
                  ) : null}
                  {searchResults.map((profile) => (
                    <CommandItem
                      key={profile.id}
                      value={profile.id}
                      onSelect={() => {
                        onSelect(profile.id, profile);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={
                          selectedId === profile.id ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'
                        }
                        aria-hidden
                      />
                      {formatProfileOptionLabel(profile)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CompetenciesEvaluationPage() {
  const { user, isHR, isManager } = useAuth();
  const canManage = isHR() || isManager();

  const [hrSearchQuery, setHrSearchQuery] = useState('');
  const [hrSelectedLabel, setHrSelectedLabel] = useState('');
  const [hrResults, setHrResults] = useState<ProfileOption[]>([]);
  const [isHrSearching, setIsHrSearching] = useState(false);

  const [managerSearchQuery, setManagerSearchQuery] = useState('');
  const [managerSelectedLabel, setManagerSelectedLabel] = useState('');
  const [managerResults, setManagerResults] = useState<ProfileOption[]>([]);
  const [isManagerSearching, setIsManagerSearching] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const employeeIdRef = useRef('');
  const managerInitialPickDone = useRef(false);

  const [catalog, setCatalog] = useState<EvaluationCompetencyRow[]>([]);
  const [assignments, setAssignments] = useState<PerformanceCompetencyAssignmentRow[]>([]);
  const [evaluations, setEvaluations] = useState<PerformanceCompetencyEvaluationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { rating: string; comment: string }>>({});

  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isLoadingEmployeeData, setIsLoadingEmployeeData] = useState(false);

  const [editRow, setEditRow] = useState<AssignmentWithCompetency | null>(null);
  const [editWeightPercent, setEditWeightPercent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [savingRatingId, setSavingRatingId] = useState<string | null>(null);

  const tenantId = user?.tenantId;
  const debouncedHrSearchQuery = useDebouncedValue(hrSearchQuery.trim(), EMPLOYEE_SEARCH_DEBOUNCE_MS);
  const debouncedManagerSearchQuery = useDebouncedValue(
    managerSearchQuery.trim(),
    EMPLOYEE_SEARCH_DEBOUNCE_MS
  );
  const hrSearchSeqRef = useRef(0);
  const managerSearchSeqRef = useRef(0);

  useEffect(() => {
    employeeIdRef.current = employeeId;
  }, [employeeId]);

  const syncDraftsFromRows = useCallback(
    (catalogRows: EvaluationCompetencyRow[], evaluationRows: PerformanceCompetencyEvaluationRow[]) => {
      const draftByCompetency: Record<string, { rating: string; comment: string }> = {};
      const evaluationsByCompetency = new Map(
        evaluationRows.map((evaluation) => [evaluation.competency_id, evaluation])
      );

      for (const competency of catalogRows) {
        const existing = evaluationsByCompetency.get(competency.id);
        draftByCompetency[competency.id] = {
          rating: existing?.rating != null ? String(existing.rating) : '',
          comment: existing?.manager_comment ?? '',
        };
      }
      setDrafts(draftByCompetency);
    },
    []
  );

  useEffect(() => {
    if (user?.role === 'employee' && user.id) {
      setEmployeeId(user.id);
    }
  }, [user?.role, user?.id]);

  useEffect(() => {
    if (user?.role !== 'manager') {
      managerInitialPickDone.current = false;
      setManagerResults([]);
      return;
    }
    if (!tenantId || !user.id) return;

    const seq = ++managerSearchSeqRef.current;
    const managerUserId = user.id;
    setIsManagerSearching(true);

    void (async () => {
      try {
        const { data, error } = await searchObjectivesEmployees({
          tenantId,
          excludeUserId: managerUserId,
          searchTerm: debouncedManagerSearchQuery,
          scope: { kind: 'manager_direct_reports', managerId: managerUserId },
          limit: EMPLOYEE_LIST_LIMIT,
        });
        if (seq !== managerSearchSeqRef.current) return;
        if (error) throw error;
        const list = (data ?? []) as ProfileOption[];
        setManagerResults(list);

        const currentEmployeeId = employeeIdRef.current;
        let nextEmployeeId: string;
        if (currentEmployeeId) {
          nextEmployeeId = currentEmployeeId;
        } else if (!managerInitialPickDone.current && list.length > 0) {
          nextEmployeeId = list[0].id;
          managerInitialPickDone.current = true;
        } else {
          nextEmployeeId = '';
        }

        setEmployeeId(nextEmployeeId);
        const selected = list.find((option) => option.id === nextEmployeeId);
        if (selected) {
          setManagerSelectedLabel(formatProfileOptionLabel(selected));
        } else if (!nextEmployeeId) {
          setManagerSelectedLabel('');
        }
      } catch (error) {
        if (seq === managerSearchSeqRef.current) {
          toast({
            title: 'Erro na busca',
            description: errorMessage(error),
            variant: 'destructive',
          });
        }
      } finally {
        if (seq === managerSearchSeqRef.current) {
          setIsManagerSearching(false);
        }
      }
    })();
  }, [debouncedManagerSearchQuery, tenantId, user?.role, user?.id]);

  useEffect(() => {
    if (user?.role !== 'hr') {
      setHrResults([]);
      return;
    }
    if (!tenantId || !user.id) return;

    const seq = ++hrSearchSeqRef.current;
    setIsHrSearching(true);
    void (async () => {
      try {
        const { data, error } = await searchObjectivesEmployees({
          tenantId,
          excludeUserId: user.id,
          searchTerm: debouncedHrSearchQuery,
          scope: { kind: 'hr_tenant_employees' },
          limit: EMPLOYEE_LIST_LIMIT,
        });
        if (seq !== hrSearchSeqRef.current) return;
        if (error) throw error;
        setHrResults((data ?? []) as ProfileOption[]);
      } catch (error) {
        if (seq === hrSearchSeqRef.current) {
          toast({
            title: 'Erro na busca',
            description: errorMessage(error),
            variant: 'destructive',
          });
        }
      } finally {
        if (seq === hrSearchSeqRef.current) {
          setIsHrSearching(false);
        }
      }
    })();
  }, [debouncedHrSearchQuery, tenantId, user?.role, user?.id]);

  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const rows = await listEvaluationCompetencies();
      setCatalog(rows);
    } catch (error) {
      toast({
        title: 'Erro ao carregar catálogo',
        description: errorMessage(error),
        variant: 'destructive',
      });
      setCatalog([]);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  const ensureCatalogAssignments = useCallback(
    async (employeeIdValue: string, currentAssignments: PerformanceCompetencyAssignmentRow[]) => {
      if (catalog.length === 0) return currentAssignments;

      const catalogLimited = [...catalog]
        .sort((a, b) => a.order - b.order)
        .slice(0, MAX_COMPETENCY_ASSIGNMENTS);

      const expectedIds = new Set(catalogLimited.map((item) => item.id));
      const currentByCompetency = new Map(
        currentAssignments.map((assignment) => [assignment.competency_id, assignment])
      );
      const missingCompetencies = catalogLimited.filter((item) => !currentByCompetency.has(item.id));

      if (missingCompetencies.length === 0) {
        return currentAssignments.filter((assignment) => expectedIds.has(assignment.competency_id));
      }

      const distribution = distributePercentEvenly(100, catalogLimited.length);
      await Promise.all(
        catalogLimited.map(async (competency, index) => {
          const existing = currentByCompetency.get(competency.id);
          const nextWeight = percentToDecimal(distribution[index]);
          if (existing) {
            await updatePerformanceCompetencyAssignment(existing.id, { item_weight: nextWeight });
            return;
          }
          await insertPerformanceCompetencyAssignment({
            employee_id: employeeIdValue,
            competency_id: competency.id,
            item_weight: nextWeight,
          });
        })
      );

      return await listPerformanceCompetencyAssignments(employeeIdValue);
    },
    [catalog]
  );

  const loadEmployeeData = useCallback(async () => {
    if (!employeeId) {
      setAssignments([]);
      setEvaluations([]);
      setDrafts({});
      return;
    }
    setIsLoadingEmployeeData(true);
    try {
      const [assignmentRows, evaluationRows] = await Promise.all([
        listPerformanceCompetencyAssignments(employeeId),
        listPerformanceCompetencyEvaluations(employeeId),
      ]);
      const ensuredAssignments = await ensureCatalogAssignments(employeeId, assignmentRows);
      setAssignments(ensuredAssignments);
      setEvaluations(evaluationRows);
      syncDraftsFromRows(catalog, evaluationRows);
    } catch (error) {
      toast({
        title: 'Erro ao carregar competências',
        description: errorMessage(error),
        variant: 'destructive',
      });
      setAssignments([]);
      setEvaluations([]);
      setDrafts({});
    } finally {
      setIsLoadingEmployeeData(false);
    }
  }, [catalog, employeeId, ensureCatalogAssignments, syncDraftsFromRows]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadEmployeeData();
  }, [loadEmployeeData]);

  const assignmentsWeightPercentTotal = useMemo(
    () => getAssignmentsWeightPercentTotal(assignments),
    [assignments]
  );

  const assignmentsByCompetencyId = useMemo(() => {
    const map = new Map<string, PerformanceCompetencyAssignmentRow>();
    for (const assignment of assignments) {
      map.set(assignment.competency_id, assignment);
    }
    return map;
  }, [assignments]);

  const assignmentRowsWithCatalog = useMemo<AssignmentWithCompetency[]>(() => {
    const catalogById = new Map(catalog.map((item) => [item.id, item]));
    return assignments
      .map((assignment) => {
        const competency = catalogById.get(assignment.competency_id);
        return {
          ...assignment,
          competencyName: competency?.name ?? assignment.competency_id,
          competencyDescription: competency?.description ?? 'Descrição não encontrada no catálogo.',
        };
      })
      .sort((a, b) => a.competencyName.localeCompare(b.competencyName, 'pt-BR'));
  }, [assignments, catalog]);

  const hasAllCatalogRatingsSaved = useMemo(
    () => areAllCatalogCompetenciesRated({ catalog, evaluations }),
    [catalog, evaluations]
  );

  const ratedCatalogCount = useMemo(() => {
    const ratedCompetencyIds = new Set<string>();
    for (const evaluation of evaluations) {
      if (Number.isInteger(evaluation.rating) && evaluation.rating != null && evaluation.rating >= 1 && evaluation.rating <= 3) {
        ratedCompetencyIds.add(evaluation.competency_id);
      }
    }
    return catalog.reduce(
      (count, competency) => (ratedCompetencyIds.has(competency.id) ? count + 1 : count),
      0
    );
  }, [catalog, evaluations]);

  const catalogEvaluationTotal = catalog.length;
  const isCatalogEvaluationComplete = catalogEvaluationTotal > 0 && hasAllCatalogRatingsSaved;

  const managerWeightedPreview = useMemo(
    () =>
      canManage
        ? computeCompetenciesWeightedAverage({
            assignments,
            evaluations,
          })
        : null,
    [assignments, canManage, evaluations]
  );

  const employeeWeightedScore = useMemo(
    () =>
      !canManage
        ? computeCompetenciesWeightedAverage({
            assignments,
            evaluations,
          })
        : null,
    [assignments, canManage, evaluations]
  );

  const openEditDialog = (row: AssignmentWithCompetency) => {
    setEditRow(row);
    setEditWeightPercent(String(decimalToPercent(Number(row.item_weight))));
  };

  const handleSubmitEdit = async () => {
    if (!editRow) return;
    const weightPercent = parseWeightPercent(editWeightPercent);
    if (weightPercent == null || weightPercent <= 0) {
      toast({
        title: 'Peso inválido',
        description: 'Informe um percentual válido entre 0.01 e 100.',
        variant: 'destructive',
      });
      return;
    }

    const assignmentsForRebalance = assignments.map((assignment) => ({
      id: assignment.id,
      weightPercent: decimalToPercent(Number(assignment.item_weight)),
    }));
    const rebalancedWeights = rebalanceWeightsProportionally({
      editedAssignmentId: editRow.id,
      editedWeightPercent: weightPercent,
      assignments: assignmentsForRebalance,
    });

    if (!rebalancedWeights) {
      const minimumOthersTotal = (assignments.length - 1) * 0.01;
      const maximumThisWeight = Math.max(0.01, 100 - minimumOthersTotal);
      toast({
        title: 'Peso inválido para rebalanceamento',
        description: `Com ${assignments.length} competência(s), o peso máximo para esta edição é ${maximumThisWeight.toFixed(2)}%.`,
        variant: 'destructive',
      });
      return;
    }

    const currentEditedWeightPercent = decimalToPercent(Number(editRow.item_weight));
    const isIncreasingEditedWeight = weightPercent > currentEditedWeightPercent;
    const updates = rebalancedWeights.filter((item) => {
      const current = assignmentsForRebalance.find((assignment) => assignment.id === item.id);
      if (!current) return false;
      return Math.abs(current.weightPercent - item.weightPercent) > 0.001;
    });

    const sortedUpdates = [...updates].sort((a, b) => {
      if (a.id === editRow.id) return isIncreasingEditedWeight ? 1 : -1;
      if (b.id === editRow.id) return isIncreasingEditedWeight ? -1 : 1;
      return 0;
    });

    setIsSavingEdit(true);
    try {
      for (const update of sortedUpdates) {
        await updatePerformanceCompetencyAssignment(update.id, {
          item_weight: percentToDecimal(update.weightPercent),
        });
      }
      toast({ title: 'Competência atualizada' });
      setEditRow(null);
      await loadEmployeeData();
    } catch (error) {
      toast({ title: 'Erro ao atualizar', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveEvaluation = async (competencyId: string) => {
    if (!employeeId) return;
    const draft = drafts[competencyId] ?? { rating: '', comment: '' };
    const parsedRating = draft.rating === '' ? null : Number(draft.rating);
    if (parsedRating != null && (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 3)) {
      toast({
        title: 'Nota inválida',
        description: 'A nota deve estar entre 1 e 3.',
        variant: 'destructive',
      });
      return;
    }

    setSavingRatingId(competencyId);
    try {
      await upsertPerformanceCompetencyEvaluation({
        employee_id: employeeId,
        competency_id: competencyId,
        rating: parsedRating,
        manager_comment: draft.comment.trim() || null,
      });
      toast({ title: 'Avaliação salva' });
      const nextEvaluations = await listPerformanceCompetencyEvaluations(employeeId);
      setEvaluations(nextEvaluations);
      syncDraftsFromRows(catalog, nextEvaluations);
    } catch (error) {
      toast({
        title: 'Erro ao salvar avaliação',
        description: errorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSavingRatingId(null);
    }
  };

  if (!user) return null;

  return (
    <MainLayout>
      <div className="space-y-6 md:space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Competências</h1>
          {canManage ? (
            <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
              As competências são carregadas do catálogo evaluation_competencies. Ajuste os pesos para somarem
              100% e registre a avaliação do gestor em escala de 1 a 3.
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
              Visualize as competências atribuídas, seus pesos e as avaliações registradas pelo gestor.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          {canManage && isHR() ? (
            <div className="space-y-2 w-full md:min-w-[260px] md:flex-1">
              <Label htmlFor="comp-hr-employee-combobox">Colaborador</Label>
              <EmployeeSearchCombobox
                comboboxId="comp-hr-employee-combobox"
                selectedId={employeeId}
                selectedLabel={hrSelectedLabel}
                searchQuery={hrSearchQuery}
                onSearchQueryChange={setHrSearchQuery}
                searchResults={hrResults}
                searchLoading={isHrSearching}
                onSelect={(id, option) => {
                  setEmployeeId(id);
                  setHrSelectedLabel(id && option ? formatProfileOptionLabel(option) : '');
                  setHrSearchQuery('');
                }}
                placeholder="Buscar e selecionar…"
              />
              <p className="text-xs text-muted-foreground">Busca por nome, e-mail, setor ou cargo.</p>
            </div>
          ) : null}

          {canManage && isManager() ? (
            <div className="space-y-2 w-full md:min-w-[260px] md:flex-1">
              <Label htmlFor="comp-manager-employee-combobox">Colaborador</Label>
              <EmployeeSearchCombobox
                comboboxId="comp-manager-employee-combobox"
                selectedId={employeeId}
                selectedLabel={managerSelectedLabel}
                searchQuery={managerSearchQuery}
                onSearchQueryChange={setManagerSearchQuery}
                searchResults={managerResults}
                searchLoading={isManagerSearching}
                onSelect={(id, option) => {
                  setEmployeeId(id);
                  setManagerSelectedLabel(id && option ? formatProfileOptionLabel(option) : '');
                  setManagerSearchQuery('');
                }}
                placeholder="Buscar e selecionar…"
              />
              <p className="text-xs text-muted-foreground">Sua equipe: busca por nome, e-mail, setor ou cargo.</p>
            </div>
          ) : null}
        </div>

        {!employeeId && canManage ? (
          <p className="text-sm text-muted-foreground">
            {isHR()
              ? 'Use o campo acima para escolher um colaborador e gerenciar as competências dele.'
              : 'Use o campo acima para escolher um colaborador da sua equipe e gerenciar as competências dele.'}
          </p>
        ) : null}

        {employeeId ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {canManage && assignments.length > 0 ? (
                  <span
                    className={cn(
                      'text-sm rounded-md border px-3 py-1',
                      assignmentsWeightPercentTotal === 100
                        ? 'border-border bg-muted/40 text-muted-foreground'
                        : 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                    )}
                  >
                    Total dos pesos:{' '}
                    <span className="font-medium text-foreground">{assignmentsWeightPercentTotal.toFixed(2)}%</span>
                    {assignmentsWeightPercentTotal !== 100 ? ' (deve ser 100%)' : null}
                  </span>
                ) : null}
                {canManage && managerWeightedPreview != null ? (
                  <span className="text-sm text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-1">
                    Média ponderada (prévia):{' '}
                    <span className="font-medium text-foreground">{managerWeightedPreview.toFixed(2)}</span>
                  </span>
                ) : null}
                {!canManage && employeeWeightedScore != null ? (
                  <span className="text-sm text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-1">
                    Média geral (ponderada):{' '}
                    <span className="font-medium text-foreground">{employeeWeightedScore.toFixed(2)}</span>
                  </span>
                ) : null}
              </div>
            </div>

            {canManage ? (
              <CompetenciesList
                assignments={assignmentRowsWithCatalog}
                isLoading={isLoadingEmployeeData}
                canManage={canManage}
                onEdit={openEditDialog}
              />
            ) : null}

            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">Avaliação das competências</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={cn(
                      'rounded-md border px-2.5 py-1',
                      isCatalogEvaluationComplete
                        ? 'border-border bg-muted/40 text-muted-foreground'
                        : 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                    )}
                  >
                    Catálogo completo:{' '}
                    {isCatalogEvaluationComplete ? 'OK' : 'Pendente'} ({ratedCatalogCount}/{catalogEvaluationTotal}{' '}
                    avaliadas)
                  </span>
                </div>
              </div>

              {isLoadingCatalog ? (
                <p className="text-sm text-muted-foreground">Carregando catálogo de competências…</p>
              ) : (
                <div className="space-y-4">
                  {catalog.map((competency) => {
                    const draft = drafts[competency.id] ?? { rating: '', comment: '' };
                    return (
                      <CompetencyEvaluationForm
                        key={competency.id}
                        competency={competency}
                        draft={draft}
                        canManage={canManage}
                        isAssigned={assignmentsByCompetencyId.has(competency.id)}
                        isSaving={savingRatingId === competency.id}
                        onDraftChange={(nextDraft) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [competency.id]: nextDraft,
                          }))
                        }
                        onSave={() => void handleSaveEvaluation(competency.id)}
                      />
                    );
                  })}
                </div>
              )}

              {canManage ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    Para concluir a etapa, registre as notas e comentários em todas as competências do catálogo.
                  </p>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>

      <CompetencyForm
        open={!!editRow}
        mode="edit"
        title="Editar competência"
        competencyOptions={
          editRow
            ? catalog.filter((competency) => competency.id === editRow.competency_id)
            : []
        }
        selectedCompetencyId={editRow?.competency_id ?? ''}
        weightPercent={editWeightPercent}
        isSaving={isSavingEdit}
        autoBalanceEnabled={false}
        disableCompetencyField
        helperText="Ajuste para que, com as demais competências, o total continue em 100%."
        onOpenChange={(open) => {
          if (!open) setEditRow(null);
        }}
        onSelectedCompetencyIdChange={() => {}}
        onWeightPercentChange={setEditWeightPercent}
        onAutoBalanceEnabledChange={() => {}}
        onSubmit={() => void handleSubmitEdit()}
      />
    </MainLayout>
  );
}
