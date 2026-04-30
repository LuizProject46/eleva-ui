import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { computeObjectivesWeightedAverage } from '@/lib/performanceObjectiveScoring';
import {
  deletePerformanceObjective,
  insertPerformanceObjective,
  insertPerformanceObjectiveAllocating,
  listPerformanceObjectives,
  updatePerformanceObjective,
} from '@/services/performanceObjectivesService';
import {
  searchObjectivesEmployees,
  type ObjectivesEmployeeSearchRow,
} from '@/services/objectivesEmployeeSearchService';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PerformanceObjectiveRow } from '@/types/performanceObjective';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ProfileOption = ObjectivesEmployeeSearchRow;

const RATING_OPTIONS = [
  { value: '1', label: 'Abaixo das expectativas', short: 'Abaixo', scaleLabel: '1' },
  { value: '2', label: 'Atende às expectativas', short: 'Atende', scaleLabel: '2' },
  { value: '3', label: 'Acima das expectativas', short: 'Acima', scaleLabel: '3' },
] as const;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const OBJECTIVES_EMPLOYEE_LIST_LIMIT = 10;
const OBJECTIVES_EMPLOYEE_SEARCH_DEBOUNCE_MS = 350;

function formatProfileOptionLabel(p: ProfileOption): string {
  return p.department ? `${p.name} · ${p.department}` : p.name;
}

/** Popover + busca assíncrona; lista limitada a 10 itens. */
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
  onSearchQueryChange: (q: string) => void;
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
                  {searchResults.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onSelect(p.id, p);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={
                          selectedId === p.id ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'
                        }
                        aria-hidden
                      />
                      {formatProfileOptionLabel(p)}
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

/** Parses objective allocation percent (integer 1–100). */
function parsePercentWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 1 || n > 100) return null;
  return n;
}

export function ObjectivesEvaluationPage() {
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

  const employeeIdRef = useRef('');
  const managerInitialPickDone = useRef(false);

  const [employeeId, setEmployeeId] = useState<string>('');

  const [objectives, setObjectives] = useState<PerformanceObjectiveRow[]>([]);
  const [isLoadingObjectives, setIsLoadingObjectives] = useState(false);

  const [drafts, setDrafts] = useState<
    Record<string, { rating: string; comment: string }>
  >({});

  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addWeight, setAddWeight] = useState('100');
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  const [editRow, setEditRow] = useState<PerformanceObjectiveRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWeight, setEditWeight] = useState('100');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [savingRatingId, setSavingRatingId] = useState<string | null>(null);

  const tenantId = user?.tenantId;

  const debouncedHrSearchQuery = useDebouncedValue(
    hrSearchQuery.trim(),
    OBJECTIVES_EMPLOYEE_SEARCH_DEBOUNCE_MS
  );
  const debouncedManagerSearchQuery = useDebouncedValue(
    managerSearchQuery.trim(),
    OBJECTIVES_EMPLOYEE_SEARCH_DEBOUNCE_MS
  );

  const hrSearchSeqRef = useRef(0);
  const managerSearchSeqRef = useRef(0);

  useEffect(() => {
    employeeIdRef.current = employeeId;
  }, [employeeId]);

  const syncDraftsFromRows = useCallback((rows: PerformanceObjectiveRow[]) => {
    const next: Record<string, { rating: string; comment: string }> = {};
    for (const o of rows) {
      next[o.id] = {
        rating: o.rating != null ? String(o.rating) : '',
        comment: o.manager_comment ?? '',
      };
    }
    setDrafts(next);
  }, []);

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
          limit: OBJECTIVES_EMPLOYEE_LIST_LIMIT,
        });
        if (seq !== managerSearchSeqRef.current) return;
        if (error) throw error;
        const list = (data ?? []) as ProfileOption[];
        setManagerResults(list);

        const cur = employeeIdRef.current;
        let nextId: string;
        if (cur) {
          nextId = cur;
        } else if (!managerInitialPickDone.current && list.length > 0) {
          nextId = list[0].id;
          managerInitialPickDone.current = true;
        } else {
          nextId = '';
        }

        setEmployeeId(nextId);
        const sel = list.find((o) => o.id === nextId);
        if (sel) {
          setManagerSelectedLabel(formatProfileOptionLabel(sel));
        } else if (!nextId) {
          setManagerSelectedLabel('');
        }
      } catch (e) {
        if (seq === managerSearchSeqRef.current) {
          toast({ title: 'Erro na busca', description: errorMessage(e), variant: 'destructive' });
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
    const currentUserId = user.id;
    setIsHrSearching(true);

    void (async () => {
      try {
        const { data, error } = await searchObjectivesEmployees({
          tenantId,
          excludeUserId: currentUserId,
          searchTerm: debouncedHrSearchQuery,
          scope: { kind: 'hr_tenant_employees' },
          limit: OBJECTIVES_EMPLOYEE_LIST_LIMIT,
        });
        if (seq !== hrSearchSeqRef.current) return;
        if (error) throw error;
        setHrResults((data ?? []) as ProfileOption[]);
      } catch (e) {
        if (seq === hrSearchSeqRef.current) {
          toast({ title: 'Erro na busca', description: errorMessage(e), variant: 'destructive' });
        }
      } finally {
        if (seq === hrSearchSeqRef.current) {
          setIsHrSearching(false);
        }
      }
    })();
  }, [debouncedHrSearchQuery, tenantId, user?.role, user?.id]);

  useEffect(() => {
    if (user?.role === 'employee' && user.id) {
      setEmployeeId(user.id);
    }
  }, [user?.role, user?.id]);

  const loadObjectives = useCallback(async () => {
    if (!employeeId) {
      setObjectives([]);
      return;
    }
    setIsLoadingObjectives(true);
    try {
      const rows = await listPerformanceObjectives(employeeId);
      setObjectives(rows);
      syncDraftsFromRows(rows);
    } catch (e) {
      toast({ title: 'Erro ao carregar objetivos', description: errorMessage(e), variant: 'destructive' });
      setObjectives([]);
    } finally {
      setIsLoadingObjectives(false);
    }
  }, [employeeId, syncDraftsFromRows]);

  useEffect(() => {
    void loadObjectives();
  }, [loadObjectives]);

  const objectivesWeightsTotal = useMemo(
    () => objectives.reduce((s, o) => s + Math.round(Number(o.item_weight)), 0),
    [objectives]
  );

  const canAddAnotherObjective = objectives.length < 5;

  const managerWeightedPreview = useMemo(
    () => (canManage ? computeObjectivesWeightedAverage(objectives) : null),
    [canManage, objectives]
  );

  const employeeWeightedScore = useMemo(
    () => (!canManage ? computeObjectivesWeightedAverage(objectives) : null),
    [canManage, objectives]
  );

  const handleOpenAdd = () => {
    if (!canAddAnotherObjective) {
      toast({
        title: 'Não é possível adicionar',
        description: 'Limite de cinco objetivos atingido.',
        variant: 'destructive',
      });
      return;
    }
    setAddTitle('');
    setAddDescription('');
    const n = objectives.length;
    const suggested =
      n === 0
        ? 100
        : objectivesWeightsTotal < 100
          ? Math.min(100, Math.max(1, 100 - objectivesWeightsTotal))
          : Math.max(1, Math.min(100 - n, Math.round(100 / (n + 1))));
    setAddWeight(String(suggested));
    setAddOpen(true);
  };

  const handleSubmitAdd = async () => {
    if (!employeeId) return;
    const title = addTitle.trim();
    if (!title) {
      toast({ title: 'Informe o título do objetivo', variant: 'destructive' });
      return;
    }
    const w = parsePercentWeight(addWeight);
    if (w === null) {
      toast({
        title: 'Peso inválido',
        description: 'Informe um percentual inteiro entre 1 e 100.',
        variant: 'destructive',
      });
      return;
    }
    const n = objectives.length;
    const maxSort = objectives.reduce((m, o) => Math.max(m, o.sort_order), -1);

    if (n === 0 && w !== 100) {
      toast({
        title: 'Primeiro objetivo',
        description: 'O primeiro objetivo deve ter peso 100%.',
        variant: 'destructive',
      });
      return;
    }

    if (n > 0 && objectivesWeightsTotal === 100) {
      const maxNew = 100 - n;
      if (w > maxNew) {
        toast({
          title: 'Peso alto demais para este novo objetivo',
          description: `Com ${n} objetivo(s) já cadastrado(s), o novo pode ter no máximo ${maxNew}% (cada um precisa de pelo menos 1%).`,
          variant: 'destructive',
        });
        return;
      }
    } else if (n > 0) {
      const nextTotal = objectivesWeightsTotal + w;
      if (nextTotal !== 100) {
        toast({
          title: 'Total de pesos deve ser 100%',
          description: `Com este peso, o total seria ${nextTotal}%. Ajuste para que a soma com os demais objetivos seja exatamente 100%.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSavingAdd(true);
    try {
      if (n > 0 && objectivesWeightsTotal === 100) {
        await insertPerformanceObjectiveAllocating({
          employee_id: employeeId,
          title,
          description: addDescription.trim() || null,
          sort_order: maxSort + 1,
          new_item_weight: w,
        });
      } else {
        await insertPerformanceObjective({
          employee_id: employeeId,
          title,
          description: addDescription.trim() || null,
          sort_order: maxSort + 1,
          item_weight: w,
        });
      }
      toast({ title: 'Objetivo criado' });
      setAddOpen(false);
      await loadObjectives();
    } catch (e) {
      toast({ title: 'Erro ao criar', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setIsSavingAdd(false);
    }
  };

  const handleOpenEdit = (row: PerformanceObjectiveRow) => {
    setEditRow(row);
    setEditTitle(row.title);
    setEditDescription(row.description ?? '');
    setEditWeight(String(row.item_weight));
  };

  const handleSubmitEdit = async () => {
    if (!editRow) return;
    const title = editTitle.trim();
    if (!title) {
      toast({ title: 'Informe o título', variant: 'destructive' });
      return;
    }
    const w = parsePercentWeight(editWeight);
    if (w === null) {
      toast({
        title: 'Peso inválido',
        description: 'Informe um percentual inteiro entre 1 e 100.',
        variant: 'destructive',
      });
      return;
    }
    const sumOthers = objectives
      .filter((o) => o.id !== editRow.id)
      .reduce((s, o) => s + Math.round(Number(o.item_weight)), 0);
    if (sumOthers + w !== 100) {
      toast({
        title: 'Total de pesos deve ser 100%',
        description: `Os outros objetivos somam ${sumOthers}%. Este objetivo deve ter ${100 - sumOthers}% para o total ser 100%.`,
        variant: 'destructive',
      });
      return;
    }
    setIsSavingEdit(true);
    try {
      await updatePerformanceObjective(editRow.id, {
        title,
        description: editDescription.trim() || null,
        item_weight: w,
      });
      toast({ title: 'Objetivo atualizado' });
      setEditRow(null);
      await loadObjectives();
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveRating = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    const ratingVal = d.rating === '' ? null : Number(d.rating);
    if (ratingVal !== null && (ratingVal < 1 || ratingVal > 3 || !Number.isInteger(ratingVal))) {
      toast({ title: 'Selecione uma nota válida', variant: 'destructive' });
      return;
    }
    setSavingRatingId(id);
    try {
      await updatePerformanceObjective(id, {
        rating: ratingVal,
        manager_comment: d.comment.trim() || null,
      });
      toast({ title: 'Avaliação salva' });
      await loadObjectives();
    } catch (e) {
      toast({ title: 'Erro ao salvar avaliação', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setSavingRatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deletePerformanceObjective(deleteId);
      toast({ title: 'Objetivo removido' });
      setDeleteId(null);
      await loadObjectives();
    } catch (e) {
      toast({ title: 'Erro ao remover', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <MainLayout>
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Objetivos</h1>
        {canManage ? (
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
            Escolha o colaborador, cadastre até cinco objetivos e distribua os pesos para somarem 100%.
            Depois, registre a avaliação (notas 1 a 3 e comentários opcionais). A média final do ciclo usa
            esses pesos automaticamente.
          </p>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
            Veja cada objetivo, o peso que ele tem na sua nota e a avaliação do gestor. Abaixo você encontra
            também o retorno em comentários, quando houver.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        {canManage && isHR() && (
          <div className="space-y-2 w-full md:min-w-[260px] md:flex-1">
            <Label htmlFor="obj-hr-employee-combobox">Colaborador</Label>
            <EmployeeSearchCombobox
              comboboxId="obj-hr-employee-combobox"
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
            <p className="text-xs text-muted-foreground">
              Busca por nome, e-mail, setor ou cargo.
            </p>
          </div>
        )}

        {canManage && isManager() && (
          <div className="space-y-2 w-full md:min-w-[260px] md:flex-1">
            <Label htmlFor="obj-manager-employee-combobox">Colaborador</Label>
            <EmployeeSearchCombobox
              comboboxId="obj-manager-employee-combobox"
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
            <p className="text-xs text-muted-foreground">
              Sua equipe: busca por nome, e-mail, setor ou cargo
            </p>
          </div>
        )}
      </div>

      {!employeeId && canManage && (
        <p className="text-sm text-muted-foreground">
          {isHR()
            ? 'Use o campo acima para escolher um colaborador e ver ou editar os objetivos dele.'
            : 'Use o campo acima para escolher um colaborador da sua equipe e ver ou editar os objetivos dele.'}
        </p>
      )}

      {employeeId && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {canManage && objectives.length > 0 && (
                <span
                  className={cn(
                    'text-sm rounded-md border px-3 py-1',
                    objectivesWeightsTotal === 100
                      ? 'border-border bg-muted/40 text-muted-foreground'
                      : 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                  )}
                >
                  Total dos pesos:{' '}
                  <span className="font-medium text-foreground">{objectivesWeightsTotal}%</span>
                  {objectivesWeightsTotal !== 100 ? ' (deve ser 100%)' : null}
                </span>
              )}
              {canManage && managerWeightedPreview != null && (
                <span className="text-sm text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-1">
                  Média ponderada (prévia):{' '}
                  <span className="font-medium text-foreground">{managerWeightedPreview.toFixed(2)}</span>
                </span>
              )}
              {!canManage && employeeWeightedScore != null && (
                <span className="text-sm text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-1">
                  Média geral (ponderada):{' '}
                  <span className="font-medium text-foreground">{employeeWeightedScore.toFixed(2)}</span>
                </span>
              )}
            </div>
            {canManage && (
              <span
                title={
                  !canAddAnotherObjective ? 'Limite de cinco objetivos atingido.' : undefined
                }
                className="w-full sm:w-auto shrink-0 inline-flex"
              >
                <Button
                  type="button"
                  disabled={!canAddAnotherObjective}
                  onClick={handleOpenAdd}
                  className="w-full sm:w-auto shrink-0"
                >
                  <Plus className="w-4 h-4 mr-2" aria-hidden />
                  Novo objetivo
                </Button>
              </span>
            )}
          </div>

          {isLoadingObjectives ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : objectives.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                {canManage
                  ? 'Nenhum objetivo cadastrado. Adicione até cinco objetivos.'
                  : 'Nenhum objetivo cadastrado para você ainda.'}
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-4">
              {objectives.map((o, index) => {
                const d = drafts[o.id] ?? { rating: '', comment: '' };
                return (
                  <li key={o.id}>
                    <Card>
                      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-semibold leading-snug">
                            <span className="text-muted-foreground font-normal mr-2">{index + 1}.</span>
                            {o.title}
                          </CardTitle>
                          {canManage && o.description ? (
                            <p className="text-sm text-muted-foreground mt-2">{o.description}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground mt-2">
                            Peso nesta avaliação:{' '}
                            <span className="font-medium text-foreground">
                              {Math.round(Number(o.item_weight))}%
                            </span>
                          </p>
                        </div>
                        {canManage && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleOpenEdit(o)}
                              aria-label="Editar objetivo"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(o.id)}
                              aria-label="Excluir objetivo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            {canManage ? 'Avaliação do gestor' : 'Resultado'}
                          </Label>
                          {canManage ? (
                            <>
                              <RadioGroup
                                value={d.rating === '' ? undefined : d.rating}
                                onValueChange={(v) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [o.id]: { ...d, rating: v },
                                  }))
                                }
                                className="grid gap-2 sm:grid-cols-3"
                              >
                                {RATING_OPTIONS.map((opt) => (
                                  <label
                                    key={opt.value}
                                    htmlFor={`${o.id}-r-${opt.value}`}
                                    className={cn(
                                      'flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm transition-colors',
                                      d.rating === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                                    )}
                                  >
                                    <RadioGroupItem
                                      value={opt.value}
                                      id={`${o.id}-r-${opt.value}`}
                                      className="mt-0.5"
                                    />
                                    <span>
                                      <span className="font-medium block">{opt.short}</span>
                                      <span className="text-xs text-muted-foreground">
                                        Nota {opt.scaleLabel} na escala
                                      </span>
                                    </span>
                                  </label>
                                ))}
                              </RadioGroup>
                              {d.rating !== '' && (
                                <Button
                                  type="button"
                                  variant="link"
                                  className="h-auto p-0 text-xs text-muted-foreground"
                                  onClick={() =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [o.id]: { ...d, rating: '' },
                                    }))
                                  }
                                >
                                  Limpar nota
                                </Button>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm">
                              <div>
                                {o.rating != null ? (
                                  <p>
                                    <span className="font-medium text-foreground">
                                      {
                                        RATING_OPTIONS.find((x) => x.value === String(o.rating))
                                          ?.label ?? `Nota ${o.rating}`
                                      }
                                    </span>
                                    <span className="text-muted-foreground"> (escala {o.rating})</span>
                                  </p>
                                ) : (
                                  <p className="text-muted-foreground">Resultado ainda não disponível.</p>
                                )}
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                                  Retorno / acompanhamento
                                </p>
                                {o.manager_comment ? (
                                  <p className="text-muted-foreground whitespace-pre-wrap">{o.manager_comment}</p>
                                ) : (
                                  <p className="text-muted-foreground">Sem retorno registrado.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {canManage && (
                          <div className="space-y-2">
                            <Label htmlFor={`${o.id}-comment`}>Comentário (opcional)</Label>
                            <Textarea
                              id={`${o.id}-comment`}
                              value={d.comment}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [o.id]: { ...d, comment: e.target.value },
                                }))
                              }
                              rows={3}
                              className="resize-y min-h-[80px]"
                            />
                          </div>
                        )}
                        {canManage && (
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full sm:w-auto"
                            disabled={savingRatingId === o.id}
                            onClick={() => void handleSaveRating(o.id)}
                          >
                            {savingRatingId === o.id && (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />
                            )}
                            Salvar avaliação
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo objetivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-title">Título</Label>
              <Input
                id="add-title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Ex.: Aumentar produtividade da squad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-desc">Descrição (opcional)</Label>
              <Textarea
                id="add-desc"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-weight">Peso (%)</Label>
              <Input
                id="add-weight"
                type="number"
                inputMode="numeric"
                min={1}
                max={
                  objectives.length > 0 && objectivesWeightsTotal === 100
                    ? Math.max(1, 100 - objectives.length)
                    : 100
                }
                step={1}
                value={addWeight}
                onChange={(e) => setAddWeight(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {objectives.length === 0 ? (
                  <>O primeiro objetivo deve usar 100% do peso.</>
                ) : objectivesWeightsTotal === 100 ? (
                  <>
                    Inteiro de 1 a {Math.max(1, 100 - objectives.length)}%. Esse percentual será atribuído ao
                    novo objetivo; os pesos dos objetivos atuais serão ajustados automaticamente para somar 100%
                    com este.
                  </>
                ) : (
                  <>
                    Inteiro de 1 a 100. Com os objetivos atuais ({objectivesWeightsTotal}%), este deve completar
                    100% no total.
                  </>
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSubmitAdd()} disabled={isSavingAdd}>
              {isSavingAdd && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar objetivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Descrição (opcional)</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-weight">Peso (%)</Label>
              <Input
                id="edit-weight"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
              />
              {editRow ? (
                <p className="text-xs text-muted-foreground">
                  Os outros objetivos somam{' '}
                  {objectives
                    .filter((o) => o.id !== editRow.id)
                    .reduce((s, o) => s + Math.round(Number(o.item_weight)), 0)}
                  %. Ajuste este peso para que o total geral seja 100%.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSubmitEdit()} disabled={isSavingEdit}>
              {isSavingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir objetivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O histórico de avaliação deste objetivo será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </MainLayout>
  );
}
