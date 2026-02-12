import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star,
  TrendingUp,
  MessageSquare,
  Send,
  History,
  UserCircle,
  ChevronDown,

  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import { usePeriodicityWindow } from '@/hooks/usePeriodicityWindow';
import { PeriodUnavailableMessage } from '@/components/PeriodUnavailableMessage';
import {
  canEvaluate,
  getFormTypeOptions,
  getEvaluationTypeLabel,
  type UserRole,
  type FormTypeOption,
} from '@/lib/evaluationPermissions';

type EvaluationType =
  | 'self'
  | 'manager_to_employee'
  | 'employee_to_manager'
  | 'employee_to_hr'
  | 'employee_to_employee'
  | 'hr_to_user'
  | 'direct_feedback';

interface Competency {
  id: string;
  name: string;
  description: string;
  order: number;
}

interface EvaluationPeriod {
  id: string;
  name: string;
  year: number;
  semester: number;
}

interface ProfileOption {
  id: string;
  name: string;
  role: string;
  manager_id?: string | null;
}

interface EvaluationRecord {
  id: string;
  evaluator_id: string;
  evaluated_id: string;
  type: EvaluationType;
  status: string;
  overall_score: number | null;
  feedback_text: string | null;
  submitted_at: string | null;
  updated_at?: string | null;
  period_id?: string | null;
  period_name?: string;
  evaluator_name?: string;
  evaluated_name?: string;
  evaluated_role?: UserRole;
}

/** evaluationId -> competencyId -> { score, comment } */
type ScoresByEvaluation = Record<string, Record<string, { score: number; comment: string | null }>>;

/** Formata data em padrão brasileiro (dd/MM/yyyy) */
function formatDateBR(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const StarRating = ({
  score,
  maxScore = 5,
  size = 'md',
  interactive = false,
  onChange,
}: {
  score: number | null;
  maxScore?: number;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onChange?: (score: number) => void;
}) => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxScore }).map((_, i) => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(i + 1)}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
        >
          <Star
            className={`${sizeClass} ${score !== null && i < score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
              }`}
          />
        </button>
      ))}
    </div>
  );
};

function CompetencyRating({
  competency,
  score,
  comment,
  interactive,
  onScoreChange,
  onCommentChange,
}: {
  competency: Competency;
  score: number | null;
  comment: string;
  interactive: boolean;
  onScoreChange: (s: number) => void;
  onCommentChange: (c: string) => void;
}) {
  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{competency.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{competency.description}</p>
        </div>
        <StarRating
          score={score}
          interactive={interactive}
          onChange={onScoreChange}
        />
      </div>
      {interactive && (
        <div className="mt-3">
          <Textarea
            placeholder="Comentário opcional..."
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            className="min-h-[60px] text-sm"
          />
        </div>
      )}
      {!interactive && comment && (
        <p className="mt-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">{comment}</p>
      )}
    </div>
  );
}

function EvaluationTimelineCard({
  evaluation,
  competencies,
  scoresByEvaluationId,
  titleLabel,
  isLoading = false,
}: {
  evaluation?: EvaluationRecord;
  competencies?: Competency[];
  scoresByEvaluationId?: ScoresByEvaluation;
  /** e.g. evaluator name (Received), evaluated name (Sent/To Do), or "Autoavaliação" (Self) */
  titleLabel?: string;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="card-elevated overflow-hidden">
        <div className="w-full p-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-5 w-12 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return null;
  }

  const scores = (scoresByEvaluationId ?? {})[evaluation.id] ?? {};
  const comps = competencies ?? [];
  const isDirectFeedback = evaluation.type === 'direct_feedback';
  const hasCriteria = !isDirectFeedback && comps.length > 0;

  return (
    <Collapsible>
      <div className="card-elevated overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{titleLabel ?? '—'}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {getEvaluationTypeLabel(evaluation.type as EvaluationType, evaluation.evaluated_role)}
                {evaluation.period_name && ` · ${evaluation.period_name}`}
                {(evaluation.submitted_at || evaluation.updated_at) && (
                  <> · {formatDateBR(evaluation.submitted_at || evaluation.updated_at)}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {evaluation.overall_score != null && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{evaluation.overall_score.toFixed(1)}</span>
                </div>
              )}
              {hasCriteria && (
                <span className="text-muted-foreground flex items-center gap-1 text-sm">
                  Ver critérios
                  <ChevronDown className="h-4 w-4" />
                </span>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-4 space-y-3 bg-muted/20">
            {isDirectFeedback && evaluation.feedback_text ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
                {evaluation.feedback_text}
              </p>
            ) : hasCriteria ? (
              comps
                .sort((a, b) => a.order - b.order)
                .map((c) => {
                  const sc = scores[c.id];
                  return (
                    <CompetencyRating
                      key={c.id}
                      competency={c}
                      score={sc?.score ?? null}
                      comment={sc?.comment ?? ''}
                      interactive={false}
                      onScoreChange={() => { }}
                      onCommentChange={() => { }}
                    />
                  );
                })
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 5;

function EvaluationPagination({
  page,
  pageSize,
  totalCount,
  loading,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  loading: boolean;
  onPageChange: (p: number) => void;
  onPageSizeChange: (value: string) => void;
}) {
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
      <p className="text-sm text-muted-foreground">
        {startRow}–{endRow} de {totalCount}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Por página</Label>
          <Select value={String(pageSize)} onValueChange={onPageSizeChange}>
            <SelectTrigger className="h-9 w-[72px]">
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
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

function mapEvalRow(row: Record<string, unknown>, periods: EvaluationPeriod[]): EvaluationRecord {
  const evaluator = row.evaluator as { name?: string; role?: string } | { name?: string; role?: string }[] | null;
  const evaluated = row.evaluated as { name?: string; role?: string } | { name?: string; role?: string }[] | null;
  const period = row.period as { name?: string } | { name?: string }[] | null;
  const evaluatorObj = Array.isArray(evaluator) ? evaluator[0] : evaluator;
  const evaluatedObj = Array.isArray(evaluated) ? evaluated[0] : evaluated;
  const periodObj = Array.isArray(period) ? period[0] : period;
  const periodId = row.period_id as string | null | undefined;
  const periodName =
    periodObj?.name ?? (periodId ? periods.find((p) => p.id === periodId)?.name : undefined) ?? undefined;
  const evaluatedRole = evaluatedObj?.role as UserRole | undefined;
  return {
    id: row.id as string,
    evaluator_id: row.evaluator_id as string,
    evaluated_id: row.evaluated_id as string,
    type: row.type as EvaluationType,
    status: row.status as string,
    overall_score: row.overall_score as number | null,
    feedback_text: row.feedback_text as string | null,
    submitted_at: row.submitted_at as string | null,
    updated_at: row.updated_at as string | null,
    period_id: periodId ?? null,
    period_name: periodName,
    evaluator_name: evaluatorObj?.name ?? '—',
    evaluated_name: evaluatedObj?.name ?? '—',
    evaluated_role: evaluatedRole,
  };
}

function EvaluatedFilterCombobox({
  value,
  onValueChange,
  options,
  placeholder = 'Todos',
}: {
  value: string | undefined;
  onValueChange: (id: string | undefined) => void;
  options: ProfileOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? options.find((p) => p.id === value) : null;
  const displayValue = selected?.name ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-[180px] sm:w-[200px] justify-between font-normal hover:bg-muted/30 transition-colors hover:text-accent"
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={placeholder}
                onSelect={() => {
                  onValueChange(undefined);
                  setOpen(false);
                }}
              >
                <Check className={value == null || value === '' ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                {placeholder}
              </CommandItem>
              {options.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    onValueChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check className={value === p.id ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EvaluatedAsyncCombobox({
  selectedId,
  selectedName,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchLoading,
  onSelect,
  disabled,
  placeholder = 'Selecione...',
}: {
  selectedId: string;
  selectedName: string;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchResults: ProfileOption[];
  searchLoading: boolean;
  onSelect: (id: string, role: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const displayValue = selectedName || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="max-w-xs w-full justify-between font-normal hover:bg-muted/30 transition-colors hover:text-accent"
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome..."
            className="h-9"
            value={searchQuery}
            onValueChange={onSearchQueryChange}
          />
          <CommandList>
            {searchLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <>
                <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                <CommandGroup>
                  {selectedId && (
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        onSelect('', '');
                        setOpen(false);
                      }}
                    >
                      Limpar seleção
                    </CommandItem>
                  )}
                  {searchResults.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onSelect(p.id, p.role);
                        setOpen(false);
                      }}
                    >
                      <Check className={selectedId === p.id ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                      {p.name}
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

export default function Evaluation() {
  const { user, isHR, isManager } = useAuth();
  const { fetchNotifications } = useNotifications();
  const { isWithinPeriod, periodStatus, currentPeriod, nextPeriodStart } = usePeriodicityWindow('evaluation');
  const [activeTab, setActiveTab] = useState('recebidas');
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [peopleOptions, setPeopleOptions] = useState<ProfileOption[]>([]);
  const [receivedEvaluations, setReceivedEvaluations] = useState<EvaluationRecord[]>([]);
  const [receivedPage, setReceivedPage] = useState(1);
  const [receivedFilters, setReceivedFilters] = useState<{
    evaluatorId?: string;
    evaluatorName?: string;
    type?: string;
    periodId?: string;
  }>({});
  const [evaluatorSearchQuery, setEvaluatorSearchQuery] = useState('');
  const [evaluatorSearchResults, setEvaluatorSearchResults] = useState<ProfileOption[]>([]);
  const [evaluatorSearchLoading, setEvaluatorSearchLoading] = useState(false);
  const [receivedTotalCount, setReceivedTotalCount] = useState(0);

  const [sentEvaluations, setSentEvaluations] = useState<EvaluationRecord[]>([]);
  const [sentPage, setSentPage] = useState(1);
  const [sentFilters, setSentFilters] = useState<{
    evaluatedId?: string;
    evaluatedName?: string;
    type?: string;
    periodId?: string;
  }>({});
  const [sentEvaluatedSearchQuery, setSentEvaluatedSearchQuery] = useState('');
  const [sentEvaluatedSearchResults, setSentEvaluatedSearchResults] = useState<ProfileOption[]>([]);
  const [sentEvaluatedSearchLoading, setSentEvaluatedSearchLoading] = useState(false);
  const [sentTotalCount, setSentTotalCount] = useState(0);

  const [selfEvaluations, setSelfEvaluations] = useState<EvaluationRecord[]>([]);
  const [selfPage, setSelfPage] = useState(1);
  const [selfPeriodFilter, setSelfPeriodFilter] = useState<string>('all');
  const [selfTotalCount, setSelfTotalCount] = useState(0);

  const [teamSelfEvaluations, setTeamSelfEvaluations] = useState<EvaluationRecord[]>([]);
  const [teamSelfEvalPage, setTeamSelfEvalPage] = useState(1);
  const [teamSelfEvalFilters, setTeamSelfEvalFilters] = useState<{
    evaluatedId?: string;
    evaluatedName?: string;
    periodId?: string;
  }>({});
  const [teamSelfEvalSearchQuery, setTeamSelfEvalSearchQuery] = useState('');
  const [teamSelfEvalSearchResults, setTeamSelfEvalSearchResults] = useState<ProfileOption[]>([]);
  const [teamSelfEvalSearchLoading, setTeamSelfEvalSearchLoading] = useState(false);
  const [teamSelfEvalTotalCount, setTeamSelfEvalTotalCount] = useState(0);

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [scoresByEvaluationId, setScoresByEvaluationId] = useState<ScoresByEvaluation>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formType, setFormType] = useState<EvaluationType>('self');
  const [formTargetRole, setFormTargetRole] = useState<UserRole | null>(null);
  const [formEvaluatedId, setFormEvaluatedId] = useState<string>('');
  const [formEvaluatedRole, setFormEvaluatedRole] = useState<UserRole | null>(null);
  const [formPeriodId, setFormPeriodId] = useState<string>('none');
  const [evaluatedSearchQuery, setEvaluatedSearchQuery] = useState('');
  const [evaluatedSearchResults, setEvaluatedSearchResults] = useState<ProfileOption[]>([]);
  const [evaluatedSearchLoading, setEvaluatedSearchLoading] = useState(false);
  const [formEvaluatedName, setFormEvaluatedName] = useState('');
  const [formScores, setFormScores] = useState<Record<string, number>>({});
  const [formComments, setFormComments] = useState<Record<string, string>>({});
  const [formFeedbackText, setFormFeedbackText] = useState('');

  const fetchCompetencies = useCallback(async () => {
    const { data } = await supabase
      .from('evaluation_competencies')
      .select('id, name, description, order')
      .order('order');
    setCompetencies((data ?? []) as Competency[]);
  }, []);

  const fetchPeriods = useCallback(async () => {
    if (!user?.tenantId) return;
    const { data } = await supabase
      .from('evaluation_periods')
      .select('id, name, year, semester')
      .eq('tenant_id', user.tenantId)
      .order('year', { ascending: false })
      .order('semester', { ascending: false });
    setPeriods((data ?? []) as EvaluationPeriod[]);
  }, [user?.tenantId]);

  const fetchPeopleOptions = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, name, role, manager_id')
      .order('name');
    const list = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      manager_id: p.manager_id ?? null,
    }));
    setPeopleOptions(list);
  }, [user?.id]);

  // Evaluation targets are restricted by backend RLS (same sector or team for all roles).
  const searchProfilesForEvaluation = useCallback(
    async (
      searchTerm: string,
      targetRole: UserRole | null,
      type: EvaluationType,
      currentUser: { id: string; tenantId: string; role: string }
    ): Promise<ProfileOption[]> => {
      if (!currentUser?.tenantId || !targetRole || type === 'self') return [];
      let query = supabase
        .from('profiles')
        .select('id, name, role')
        .eq('tenant_id', currentUser.tenantId)
        .eq('role', targetRole)
        .neq('id', currentUser.id)
        .order('name')
        .limit(20);
      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm.trim()}%`);
      }
      const { data, error } = await query;
      if (error) return [];
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
      }));
    },
    []
  );

  const searchProfilesByName = useCallback(
    async (searchTerm: string, excludeId?: string): Promise<ProfileOption[]> => {
      if (!user?.tenantId) return [];
      let query = supabase
        .from('profiles')
        .select('id, name, role')
        .eq('tenant_id', user.tenantId)
        .order('name')
        .limit(20);
      if (excludeId) query = query.neq('id', excludeId);
      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm.trim()}%`);
      }
      const { data, error } = await query;
      if (error) return [];
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
      }));
    },
    [user?.tenantId]
  );

  const fetchEvaluationScores = useCallback(
    async (evaluationIds: string[], options?: { merge?: boolean }) => {
      if (evaluationIds.length === 0) {
        if (!options?.merge) setScoresByEvaluationId({});
        return;
      }
      const { data } = await supabase
        .from('evaluation_scores')
        .select('evaluation_id, competency_id, score, comment')
        .in('evaluation_id', evaluationIds);
      const map: ScoresByEvaluation = {};
      for (const row of data ?? []) {
        const eid = row.evaluation_id as string;
        if (!map[eid]) map[eid] = {};
        map[eid][row.competency_id as string] = {
          score: row.score as number,
          comment: (row.comment as string) ?? null,
        };
      }
      if (options?.merge) {
        setScoresByEvaluationId((prev) => ({ ...prev, ...map }));
      } else {
        setScoresByEvaluationId(map);
      }
    },
    []
  );

  const fetchReceivedEvaluations = useCallback(
    async (
      p: number,
      size: number,
      options?: { evaluatorId?: string; type?: string; periodId?: string }
    ) => {
      if (!user?.id) return;
      setLoading(true);
      let query = supabase
        .from('evaluations')
        .select(
          'id, evaluator_id, evaluated_id, type, status, overall_score, feedback_text, submitted_at, period_id, evaluator:profiles!evaluator_id(name), evaluated:profiles!evaluated_id(name, role), period:evaluation_periods(name)',
          { count: 'exact' }
        )
        .eq('evaluated_id', user.id)
        .eq('status', 'submitted')
        .neq('type', 'self')
        .order('submitted_at', { ascending: false });
      if (options?.evaluatorId) query = query.eq('evaluator_id', options.evaluatorId);
      if (options?.type) query = query.eq('type', options.type);
      if (options?.periodId) query = query.eq('period_id', options.periodId);
      query = query.range((p - 1) * size, p * size - 1);
      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar avaliações recebidas');
        setLoading(false);
        return;
      }
      const evals = (data ?? []).map((r) => mapEvalRow(r as Record<string, unknown>, periods));
      setReceivedEvaluations(evals);
      setReceivedTotalCount(count ?? 0);
      await fetchEvaluationScores(evals.map((e) => e.id));
      setLoading(false);
    },
    [user?.id, periods, fetchEvaluationScores]
  );

  const fetchSentEvaluations = useCallback(
    async (
      p: number,
      size: number,
      options?: { evaluatedId?: string; type?: string; periodId?: string }
    ) => {
      if (!user?.id) return;
      setLoading(true);
      let query = supabase
        .from('evaluations')
        .select(
          'id, evaluator_id, evaluated_id, type, status, overall_score, feedback_text, submitted_at, period_id, evaluated:profiles!evaluated_id(name, role), period:evaluation_periods(name)',
          { count: 'exact' }
        )
        .eq('evaluator_id', user.id)
        .eq('status', 'submitted')
        .neq('type', 'self')
        .order('submitted_at', { ascending: false });
      if (options?.evaluatedId) query = query.eq('evaluated_id', options.evaluatedId);
      if (options?.type) query = query.eq('type', options.type);
      if (options?.periodId) query = query.eq('period_id', options.periodId);
      query = query.range((p - 1) * size, p * size - 1);
      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar avaliações enviadas');
        setLoading(false);
        return;
      }
      const evals = (data ?? []).map((r) => mapEvalRow(r as Record<string, unknown>, periods));
      setSentEvaluations(evals);
      setSentTotalCount(count ?? 0);
      await fetchEvaluationScores(evals.map((e) => e.id));
      setLoading(false);
    },
    [user?.id, periods, fetchEvaluationScores]
  );

  const fetchSelfEvaluations = useCallback(
    async (p: number, size: number, options?: { periodId?: string }) => {
      if (!user?.id) return;
      setLoading(true);
      let query = supabase
        .from('evaluations')
        .select(
          'id, evaluator_id, evaluated_id, type, status, overall_score, feedback_text, submitted_at, period_id, evaluated:profiles!evaluated_id(name, role), period:evaluation_periods(name)',
          { count: 'exact' }
        )
        .eq('evaluator_id', user.id)
        .eq('evaluated_id', user.id)
        .eq('type', 'self')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });
      if (options?.periodId) query = query.eq('period_id', options.periodId);
      query = query.range((p - 1) * size, p * size - 1);
      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar autoavaliações');
        setLoading(false);
        return;
      }
      const evals = (data ?? []).map((r) => mapEvalRow(r as Record<string, unknown>, periods));
      setSelfEvaluations(evals);
      setSelfTotalCount(count ?? 0);
      await fetchEvaluationScores(evals.map((e) => e.id));
      setLoading(false);
    },
    [user?.id, periods, fetchEvaluationScores]
  );

  const fetchTeamSelfEvaluations = useCallback(
    async (p: number, size: number, options?: { evaluatedId?: string; periodId?: string }) => {
      if (!user?.tenantId) return;
      setLoading(true);
      let query = supabase
        .from('evaluations')
        .select(
          'id, evaluator_id, evaluated_id, type, status, overall_score, feedback_text, submitted_at, period_id, evaluated:profiles!evaluated_id(name, role), period:evaluation_periods(name)',
          { count: 'exact' }
        )
        .eq('tenant_id', user.tenantId)
        .eq('type', 'self')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });

      if (options?.evaluatedId) query = query.eq('evaluated_id', options.evaluatedId);
      if (options?.periodId) query = query.eq('period_id', options.periodId);

      query = query.range((p - 1) * size, p * size - 1);
      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar autoavaliações da equipe');
        setLoading(false);
        return;
      }
      const evals = (data ?? []).map((r) => mapEvalRow(r as Record<string, unknown>, periods));
      setTeamSelfEvaluations(evals);
      setTeamSelfEvalTotalCount(count ?? 0);
      await fetchEvaluationScores(evals.map((e) => e.id));
      setLoading(false);
    },
    [user?.tenantId, periods, fetchEvaluationScores]
  );

  const loadActiveTab = useCallback(() => {
    if (activeTab === 'recebidas') {
      fetchReceivedEvaluations(receivedPage, pageSize, {
        evaluatorId: receivedFilters.evaluatorId,
        type: receivedFilters.type,
        periodId: receivedFilters.periodId,
      });
    } else if (activeTab === 'enviadas') {
      fetchSentEvaluations(sentPage, pageSize, {
        evaluatedId: sentFilters.evaluatedId,
        type: sentFilters.type,
        periodId: sentFilters.periodId,
      });
    } else if (activeTab === 'autoavaliacao') {
      fetchSelfEvaluations(selfPage, pageSize, {
        periodId: selfPeriodFilter === 'all' ? undefined : selfPeriodFilter,
      });
    } else if (activeTab === 'autoavaliacoes-equipe') {
      fetchTeamSelfEvaluations(teamSelfEvalPage, pageSize, {
        evaluatedId: teamSelfEvalFilters.evaluatedId,
        periodId: teamSelfEvalFilters.periodId,
      });
    }
  }, [
    activeTab,
    receivedPage,
    sentPage,
    selfPage,
    teamSelfEvalPage,
    pageSize,
    receivedFilters,
    sentFilters,
    selfPeriodFilter,
    teamSelfEvalFilters,
    fetchReceivedEvaluations,
    fetchSentEvaluations,
    fetchSelfEvaluations,
    fetchTeamSelfEvaluations,
  ]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCompetencies(), fetchPeriods(), fetchPeopleOptions()]);
      setLoading(false);
    };
    load();
  }, [fetchCompetencies, fetchPeriods, fetchPeopleOptions]);

  useEffect(() => {
    if (!user?.id || activeTab === 'realizar') return;
    loadActiveTab();
  }, [user?.id, activeTab, loadActiveTab]);

  useEffect(() => {
    if (formType === 'self' || !formTargetRole || !user?.tenantId) {
      setEvaluatedSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setEvaluatedSearchLoading(true);
      searchProfilesForEvaluation(
        evaluatedSearchQuery,
        formTargetRole,
        formType,
        { id: user.id, tenantId: user.tenantId, role: user.role }
      ).then((list) => {
        setEvaluatedSearchResults(list);
        setEvaluatedSearchLoading(false);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [evaluatedSearchQuery, formTargetRole, formType, user?.id, user?.tenantId, user?.role, searchProfilesForEvaluation]);

  useEffect(() => {
    if (!user?.tenantId) {
      setEvaluatorSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setEvaluatorSearchLoading(true);
      searchProfilesByName(evaluatorSearchQuery, user.id).then((list) => {
        setEvaluatorSearchResults(list);
        setEvaluatorSearchLoading(false);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [evaluatorSearchQuery, user?.id, user?.tenantId, searchProfilesByName]);

  useEffect(() => {
    if (!user?.tenantId) {
      setSentEvaluatedSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSentEvaluatedSearchLoading(true);
      searchProfilesByName(sentEvaluatedSearchQuery, user.id).then((list) => {
        setSentEvaluatedSearchResults(list);
        setSentEvaluatedSearchLoading(false);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [sentEvaluatedSearchQuery, user?.id, user?.tenantId, searchProfilesByName]);

  useEffect(() => {
    if (!user?.tenantId) {
      setTeamSelfEvalSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setTeamSelfEvalSearchLoading(true);
      searchProfilesByName(teamSelfEvalSearchQuery, user.id).then((list) => {
        setTeamSelfEvalSearchResults(list);
        setTeamSelfEvalSearchLoading(false);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [teamSelfEvalSearchQuery, user?.id, user?.tenantId, searchProfilesByName]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const applyReceivedFilters = useCallback(
    (
      next: Partial<{
        evaluatorId?: string;
        evaluatorName?: string;
        type?: string;
        periodId?: string;
      }>
    ) => {
      setReceivedFilters((prev) => ({ ...prev, ...next }));
      setReceivedPage(1);
    },
    []
  );

  const applySentFilters = useCallback(
    (
      next: Partial<{
        evaluatedId?: string;
        evaluatedName?: string;
        type?: string;
        periodId?: string;
      }>
    ) => {
      setSentFilters((prev) => ({ ...prev, ...next }));
      setSentPage(1);
    },
    []
  );

  const applyTeamSelfEvalFilters = useCallback(
    (
      next: Partial<{
        evaluatedId?: string;
        evaluatedName?: string;
        periodId?: string;
      }>
    ) => {
      setTeamSelfEvalFilters((prev) => ({ ...prev, ...next }));
      setTeamSelfEvalPage(1);
    },
    []
  );

  const clearReceivedFilters = () => {
    setReceivedFilters({});
    setEvaluatorSearchQuery('');
    setReceivedPage(1);
    if (user?.id) fetchReceivedEvaluations(1, pageSize, {});
  };

  const clearSentFilters = () => {
    setSentFilters({});
    setSentEvaluatedSearchQuery('');
    setSentPage(1);
    if (user?.id) fetchSentEvaluations(1, pageSize, {});
  };

  const clearTeamSelfEvalFilters = () => {
    setTeamSelfEvalFilters({});
    setTeamSelfEvalSearchQuery('');
    setTeamSelfEvalPage(1);
    if (user?.tenantId) fetchTeamSelfEvaluations(1, pageSize, {});
  };

  const handleSelfPeriodFilterChange = (value: string) => {
    setSelfPeriodFilter(value);
    setSelfPage(1);
    if (user?.id) {
      fetchSelfEvaluations(1, pageSize, {
        periodId: value === 'all' ? undefined : value,
      });
    }
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setReceivedPage(1);
    setSentPage(1);
    setSelfPage(1);
    setTeamSelfEvalPage(1);
  };

  const myProfile = peopleOptions.find((p) => p.id === user?.id);
  const myManagerId = myProfile?.manager_id ?? null;

  const formTypeOptions: FormTypeOption[] = user
    ? getFormTypeOptions(user.role as UserRole, { managerId: myManagerId })
    : [];

  const formTypeSelectValue = (() => {
    const opt = formTypeOptions.find(
      (o) => o.type === formType && (formType === 'self' || o.targetRole === formTargetRole)
    );
    return opt?.value ?? formTypeOptions[0]?.value ?? '';
  })();

  const handleFormTypeChange = (value: string) => {
    const opt = formTypeOptions.find((o) => o.value === value);
    if (!opt) return;
    setFormType(opt.type);
    setFormTargetRole(opt.targetRole);
    setFormEvaluatedId('');
    setFormEvaluatedRole(null);
    setFormEvaluatedName('');
    setEvaluatedSearchQuery('');
    setEvaluatedSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!user?.tenantId || !user?.id) return;

    const evaluatedId = formType === 'self' ? user.id : formEvaluatedId;
    if (!evaluatedId) {
      toast.error('Selecione o avaliado');
      return;
    }

    const evaluatedRole = formType === 'self' ? (user.role as UserRole) : formEvaluatedRole;
    if (evaluatedRole != null && !canEvaluate(user.role as UserRole, evaluatedRole, formType)) {
      toast.error('Você não pode avaliar esta pessoa com o tipo selecionado.');
      return;
    }
    if (formType !== 'self' && evaluatedRole == null) {
      const profile = peopleOptions.find((p) => p.id === evaluatedId) ?? evaluatedSearchResults.find((p) => p.id === evaluatedId);
      if (profile && !canEvaluate(user.role as UserRole, profile.role as UserRole, formType)) {
        toast.error('Você não pode avaliar esta pessoa com o tipo selecionado.');
        return;
      }
    }

    const isDirectFeedback = formType === 'direct_feedback';
    if (isDirectFeedback) {
      if (!formFeedbackText.trim()) {
        toast.error('Escreva o feedback');
        return;
      }
    } else {
      const allScored = competencies.every((c) => formScores[c.id] >= 1 && formScores[c.id] <= 5);
      if (!allScored) {
        toast.error('Preencha a nota (1 a 5) em todas as competências');
        return;
      }
    }

    if (currentPeriod && user?.id) {
      const periodStart = currentPeriod.periodStartAt.toISOString();
      const periodEnd = currentPeriod.periodEndAt.toISOString();
      const { data: existing } = await supabase
        .from('evaluations')
        .select('id')
        .eq('evaluator_id', user.id)
        .eq('evaluated_id', evaluatedId)
        .eq('type', formType)
        .eq('status', 'submitted')
        .not('submitted_at', 'is', null)
        .gte('submitted_at', periodStart)
        .lt('submitted_at', periodEnd)
        .limit(1);
      if (existing?.length) {
        const nextDate = nextPeriodStart
          ? new Date(nextPeriodStart + 'T12:00:00Z').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
          : '—';
        toast.error(
          `Você já enviou esta avaliação ou feedback para este colaborador neste período. Próximo disponível em ${nextDate}.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.');
        setSubmitting(false);
        return;
      }

      const periodId = formPeriodId === 'none' ? null : formPeriodId;
      const scores = competencies.map((c) => formScores[c.id] ?? 0);
      const overallScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      const { data: evalData, error: evalError } = await supabase
        .from('evaluations')
        .insert({
          tenant_id: user.tenantId,
          period_id: periodId,
          evaluator_id: user.id,
          evaluated_id: evaluatedId,
          type: formType,
          status: 'submitted',
          overall_score: isDirectFeedback ? null : overallScore,
          feedback_text: isDirectFeedback ? formFeedbackText : null,
          submitted_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (evalError) throw evalError;
      const evaluationId = evalData?.id;
      if (!evaluationId) throw new Error('Erro ao criar avaliação');

      if (!isDirectFeedback) {
        const scoreRows = competencies
          .filter((c) => {
            const score = formScores[c.id];
            return score >= 1 && score <= 5;
          })
          .map((c) => ({
            evaluation_id: evaluationId,
            competency_id: c.id,
            score: formScores[c.id],
            comment: formComments[c.id]?.trim() || null,
          }));
        if (scoreRows.length > 0) {
          const { error: scoresError } = await supabase.from('evaluation_scores').insert(scoreRows);
          if (scoresError) throw scoresError;
        }
      }

      if (user.id !== evaluatedId) {
        const title = isDirectFeedback ? 'Você recebeu um feedback' : 'Você recebeu uma avaliação';
        const body = isDirectFeedback
          ? `${user.name} enviou um feedback para você.`
          : `${user.name} realizou uma avaliação sobre você.`;

        const { error: notificationError } = await supabase.functions.invoke('create-notification', {
          body: {
            tenant_id: user.tenantId,
            user_id: evaluatedId,
            type: isDirectFeedback ? 'feedback_received' : 'evaluation_received',
            title,
            body,
            related_id: evaluationId,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });


        if (notificationError) {
          console.error('Error creating notification:', notificationError);
        }

        const { error: emailErr } = await supabase.functions.invoke('send-notification-email', {
          body: {
            evaluatedUserId: evaluatedId,
            evaluatorName: user.name,
            type: isDirectFeedback ? 'feedback' : 'evaluation',
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (emailErr) console.warn('Email notification failed:', emailErr);
      }

      toast.success(isDirectFeedback ? 'Feedback enviado!' : 'Avaliação enviada!');

      setFormEvaluatedId('');
      setFormEvaluatedRole(null);
      setFormEvaluatedName('');
      setFormPeriodId('none');
      setFormScores({});
      setFormComments({});
      setFormFeedbackText('');
      fetchNotifications();
      setActiveTab('enviadas');
      setSentPage(1);


      await fetchSentEvaluations(1, pageSize, sentFilters);
      if (formType === 'self') {
        setSelfPage(1);
        await fetchSelfEvaluations(1, pageSize, {});
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      const isDuplicateInPeriod =
        msg.includes('já enviou') && msg.includes('neste período');
      if (isDuplicateInPeriod) {
        toast.error(
          msg.includes('Próximo disponível')
            ? msg
            : `Você já enviou esta avaliação ou feedback para este colaborador neste período. Próximo disponível em ${nextPeriodStart ? new Date(nextPeriodStart + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}.`
        );
      } else {
        toast.error('Erro ao enviar. Tente novamente.');
      }
    }
    setSubmitting(false);
  };


  if (!user) return null;

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Avaliações e Feedbacks
          </h1>
          <p className="text-muted-foreground mt-1">
            Ciclo de feedback 360° – realize avaliações, autoavaliação e feedback direto
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex w-full max-w-2xl flex-wrap gap-1">
            <TabsTrigger value="recebidas" className="flex-1 sm:flex-none">Recebidas</TabsTrigger>
            <TabsTrigger value="enviadas" className="flex-1 sm:flex-none">Enviadas</TabsTrigger>
            <TabsTrigger value="autoavaliacao" className="flex-1 sm:flex-none">Autoavaliação</TabsTrigger>
            {(isManager() || isHR()) && (
              <TabsTrigger value="autoavaliacoes-equipe" className="flex-1 sm:flex-none">Autoavaliações da equipe</TabsTrigger>
            )}
            <TabsTrigger value="realizar" className="flex-1 sm:flex-none">Realizar</TabsTrigger>
          </TabsList>

          <TabsContent value="recebidas" className="mt-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Avaliações e feedbacks que você recebeu
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Avaliador</Label>

                  <EvaluatedAsyncCombobox
                    selectedId={receivedFilters.evaluatorId ?? ''}
                    selectedName={
                      receivedFilters.evaluatorName ??
                      (receivedFilters.evaluatorId
                        ? peopleOptions.find((p) => p.id === receivedFilters.evaluatorId)?.name
                        : '') ??
                      ''
                    }
                    searchQuery={evaluatorSearchQuery}
                    onSearchQueryChange={setEvaluatorSearchQuery}
                    searchResults={evaluatorSearchResults}
                    searchLoading={evaluatorSearchLoading}
                    onSelect={(id, _role) => {
                      const name = id ? evaluatorSearchResults.find((p) => p.id === id)?.name : undefined;
                      applyReceivedFilters({ evaluatorId: id || undefined, evaluatorName: name });
                      setEvaluatorSearchQuery('');
                    }}
                    placeholder="Todos"
                  />


                  <Label className="text-sm text-muted-foreground whitespace-nowrap ml-2">Tipo</Label>
                  <Select
                    value={receivedFilters.type ?? 'all'}
                    onValueChange={(v) => applyReceivedFilters({ type: v === 'all' ? undefined : v })}
                  >
                    <SelectTrigger className="h-9 w-[180px] sm:w-[200px]">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {(['manager_to_employee', 'employee_to_manager', 'employee_to_hr', 'employee_to_employee', 'hr_to_user', 'direct_feedback'] as EvaluationType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {getEvaluationTypeLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-sm text-muted-foreground whitespace-nowrap ml-2">Período</Label>
                  <Select
                    value={receivedFilters.periodId ?? 'all'}
                    onValueChange={(v) => applyReceivedFilters({ periodId: v === 'all' ? undefined : v })}
                  >
                    <SelectTrigger className="h-9 w-[180px] sm:w-[200px]">
                      <SelectValue placeholder="Todos os períodos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os períodos</SelectItem>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(receivedFilters.evaluatorId ?? receivedFilters.type ?? receivedFilters.periodId) && (
                    <Button variant="ghost" size="sm" onClick={clearReceivedFilters}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: pageSize }, (_, i) => (
                    <EvaluationTimelineCard key={`skeleton-received-${i}`} isLoading />
                  ))}
                </div>
              ) : receivedEvaluations.length === 0 ? (
                <div className="card-elevated p-12 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma avaliação ou feedback recebido ainda</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {receivedEvaluations.map((e) => (
                      <EvaluationTimelineCard
                        key={e.id}
                        evaluation={e}
                        competencies={competencies}
                        scoresByEvaluationId={scoresByEvaluationId}
                        titleLabel={e.evaluator_name ?? '—'}
                      />
                    ))}
                  </div>
                  {receivedTotalCount > 0 && (
                    <EvaluationPagination
                      page={receivedPage}
                      pageSize={pageSize}
                      totalCount={receivedTotalCount}
                      loading={loading}
                      onPageChange={setReceivedPage}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="realizar" className="mt-6">
            {!isWithinPeriod && periodStatus && (
              <div className="mb-4">
                <PeriodUnavailableMessage
                  entityLabel="Avaliações 360°"
                  periodStatus={periodStatus}
                  currentPeriod={currentPeriod}
                  nextPeriodStart={nextPeriodStart}
                />
              </div>
            )}
            <div className="card-elevated p-6 space-y-6">
              <div className="space-y-2">
                <Label>Tipo de avaliação</Label>
                <Select value={formTypeSelectValue} onValueChange={handleFormTypeChange}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formType !== 'self' && formTargetRole != null && (
                <div className="space-y-2 flex flex-col gap-2">
                  <Label>Avaliado</Label>
                  <EvaluatedAsyncCombobox
                    selectedId={formEvaluatedId}
                    selectedName={formEvaluatedName}
                    searchQuery={evaluatedSearchQuery}
                    onSearchQueryChange={setEvaluatedSearchQuery}
                    searchResults={evaluatedSearchResults}
                    searchLoading={evaluatedSearchLoading}
                    onSelect={(id, role) => {
                      setFormEvaluatedId(id);
                      setFormEvaluatedRole(id ? (role as UserRole) : null);
                      const chosen = id ? evaluatedSearchResults.find((p) => p.id === id) : null;
                      setFormEvaluatedName(chosen?.name ?? '');
                      setEvaluatedSearchQuery('');
                    }}
                    placeholder="Buscar por nome..."
                  />
                </div>
              )}

              {formType !== 'direct_feedback' && (
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={formPeriodId} onValueChange={setFormPeriodId}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem período</SelectItem>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formType === 'direct_feedback' ? (
                <div className="space-y-2">
                  <Label>Feedback</Label>
                  <Textarea
                    placeholder="Escreva seu feedback..."
                    value={formFeedbackText}
                    onChange={(e) => setFormFeedbackText(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Competências
                  </h3>
                  {competencies.map((c) => (
                    <CompetencyRating
                      key={c.id}
                      competency={c}
                      score={formScores[c.id] ?? null}
                      comment={formComments[c.id] ?? ''}
                      interactive
                      onScoreChange={(s) => setFormScores((prev) => ({ ...prev, [c.id]: s }))}
                      onCommentChange={(s) => setFormComments((prev) => ({ ...prev, [c.id]: s }))}
                    />
                  ))}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <Button
                  className="gradient-hero"
                  onClick={handleSubmit}
                  disabled={submitting || (formType !== 'self' && !formEvaluatedId) || !isWithinPeriod}
                  title={!isWithinPeriod ? 'Envio disponível apenas no período configurado em Configurações.' : undefined}
                >
                  {submitting ? (
                    'Enviando...'
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="enviadas" className="mt-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Avaliações e feedbacks que você enviou
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Avaliado</Label>

                  <EvaluatedAsyncCombobox
                    selectedId={sentFilters.evaluatedId ?? ''}
                    selectedName={
                      sentFilters.evaluatedName ??
                      (sentFilters.evaluatedId
                        ? peopleOptions.find((p) => p.id === sentFilters.evaluatedId)?.name
                        : '') ??
                      ''
                    }
                    searchQuery={sentEvaluatedSearchQuery}
                    onSearchQueryChange={setSentEvaluatedSearchQuery}
                    searchResults={sentEvaluatedSearchResults}
                    searchLoading={sentEvaluatedSearchLoading}
                    onSelect={(id, _role) => {
                      const name = id ? sentEvaluatedSearchResults.find((p) => p.id === id)?.name : undefined;
                      applySentFilters({ evaluatedId: id || undefined, evaluatedName: name });
                      setSentEvaluatedSearchQuery('');
                    }}
                    placeholder="Todos"
                  />

                  <Label className="text-sm text-muted-foreground whitespace-nowrap ml-2">Tipo</Label>
                  <Select
                    value={sentFilters.type ?? 'all'}
                    onValueChange={(v) => applySentFilters({ type: v === 'all' ? undefined : v })}
                  >
                    <SelectTrigger className="h-9 w-[180px] sm:w-[200px]">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {(['manager_to_employee', 'employee_to_manager', 'employee_to_hr', 'employee_to_employee', 'hr_to_user', 'direct_feedback'] as EvaluationType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {getEvaluationTypeLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-sm text-muted-foreground whitespace-nowrap ml-2">Período</Label>
                  <Select
                    value={sentFilters.periodId ?? 'all'}
                    onValueChange={(v) => applySentFilters({ periodId: v === 'all' ? undefined : v })}
                  >
                    <SelectTrigger className="h-9 w-[180px] sm:w-[200px]">
                      <SelectValue placeholder="Todos os períodos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os períodos</SelectItem>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(sentFilters.evaluatedId ?? sentFilters.type ?? sentFilters.periodId) && (
                    <Button variant="ghost" size="sm" onClick={clearSentFilters}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: pageSize }, (_, i) => (
                    <EvaluationTimelineCard key={`skeleton-sent-${i}`} isLoading />
                  ))}
                </div>
              ) : sentEvaluations.length === 0 ? (
                <div className="card-elevated p-12 text-center text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma avaliação ou feedback enviado ainda</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {sentEvaluations.map((e) => (
                      <EvaluationTimelineCard
                        key={e.id}
                        evaluation={e}
                        competencies={competencies}
                        scoresByEvaluationId={scoresByEvaluationId}
                        titleLabel={e.evaluated_name ?? '—'}
                      />
                    ))}
                  </div>
                  {sentTotalCount > 0 && (
                    <EvaluationPagination
                      page={sentPage}
                      pageSize={pageSize}
                      totalCount={sentTotalCount}
                      loading={loading}
                      onPageChange={setSentPage}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="autoavaliacao" className="mt-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Histórico da sua autoavaliação
                </h2>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Período</Label>
                  <Select value={selfPeriodFilter} onValueChange={handleSelfPeriodFilterChange}>
                    <SelectTrigger className="h-9 w-[180px] sm:w-[200px]">
                      <SelectValue placeholder="Todos os períodos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os períodos</SelectItem>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: pageSize }, (_, i) => (
                    <EvaluationTimelineCard key={`skeleton-self-${i}`} isLoading />
                  ))}
                </div>
              ) : selfEvaluations.length === 0 ? (
                <div className="card-elevated p-12 text-center text-muted-foreground">
                  <UserCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma autoavaliação enviada ainda</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {selfEvaluations.map((e) => (
                      <EvaluationTimelineCard
                        key={e.id}
                        evaluation={e}
                        competencies={competencies}
                        scoresByEvaluationId={scoresByEvaluationId}
                        titleLabel="Autoavaliação"
                      />
                    ))}
                  </div>
                  {selfTotalCount > 0 && (
                    <EvaluationPagination
                      page={selfPage}
                      pageSize={pageSize}
                      totalCount={selfTotalCount}
                      loading={loading}
                      onPageChange={setSelfPage}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="autoavaliacoes-equipe" className="mt-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  {isHR() ? 'Autoavaliações da empresa' : 'Autoavaliações da equipe'}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Avaliado</Label>

                  <EvaluatedAsyncCombobox
                    selectedId={teamSelfEvalFilters.evaluatedId ?? ''}
                    selectedName={
                      teamSelfEvalFilters.evaluatedName ??
                      (teamSelfEvalFilters.evaluatedId
                        ? peopleOptions.find((p) => p.id === teamSelfEvalFilters.evaluatedId)?.name
                        : '') ??
                      ''
                    }
                    searchQuery={teamSelfEvalSearchQuery}
                    onSearchQueryChange={setTeamSelfEvalSearchQuery}
                    searchResults={teamSelfEvalSearchResults}
                    searchLoading={teamSelfEvalSearchLoading}
                    onSelect={(id, _role) => {
                      const name = id ? teamSelfEvalSearchResults.find((p) => p.id === id)?.name : undefined;
                      applyTeamSelfEvalFilters({ evaluatedId: id || undefined, evaluatedName: name });
                      setTeamSelfEvalSearchQuery('');
                    }}
                    placeholder="Todos"
                  />
                  <Label className="text-sm text-muted-foreground whitespace-nowrap ml-2">Período</Label>
                  <Select
                    value={teamSelfEvalFilters.periodId ?? 'all'}
                    onValueChange={(v) => applyTeamSelfEvalFilters({ periodId: v === 'all' ? undefined : v })}
                  >
                    <SelectTrigger className="h-9 w-[180px] sm:w-[200px]">
                      <SelectValue placeholder="Todos os períodos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os períodos</SelectItem>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(teamSelfEvalFilters.evaluatedId ?? teamSelfEvalFilters.periodId) && (
                    <Button variant="ghost" size="sm" onClick={clearTeamSelfEvalFilters}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: pageSize }, (_, i) => (
                    <EvaluationTimelineCard key={`skeleton-team-${i}`} isLoading />
                  ))}
                </div>
              ) : teamSelfEvaluations.length === 0 ? (
                <div className="card-elevated p-12 text-center text-muted-foreground">
                  <UserCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma autoavaliação da equipe ainda</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {teamSelfEvaluations.map((e) => (
                      <EvaluationTimelineCard
                        key={e.id}
                        evaluation={e}
                        competencies={competencies}
                        scoresByEvaluationId={scoresByEvaluationId}
                        titleLabel={e.evaluated_name ?? '—'}
                      />
                    ))}
                  </div>
                  {teamSelfEvalTotalCount > 0 && (
                    <EvaluationPagination
                      page={teamSelfEvalPage}
                      pageSize={pageSize}
                      totalCount={teamSelfEvalTotalCount}
                      loading={loading}
                      onPageChange={setTeamSelfEvalPage}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
