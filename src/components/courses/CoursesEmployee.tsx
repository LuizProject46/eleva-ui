import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Search, SlidersHorizontal } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { toast } from 'sonner';
import { listMyAssignmentsWithProgress } from '@/services/courseAssignmentService';
import type { Course } from '@/types/courses';
import type { MyAssignmentWithProgressRow } from '@/types/courses';
import { CourseEmployeeCard } from './CourseEmployeeCard';

const SEARCH_DEBOUNCE_MS = 300;
const STATUS_FILTER_ALL = 'all';
type StatusFilterValue = 'all' | 'completed' | 'in_progress';

/** Build a minimal course-like object for the card from RPC row. */
function rowToCourse(row: MyAssignmentWithProgressRow): Course {
  return {
    id: row.course_id,
    tenant_id: row.course_tenant_id,
    title: row.course_title,
    description: row.course_description,
    type: row.course_type,
    source: 'manual',
    cover_url: row.course_cover_url,
    workload_hours: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  };
}

function getProgressLabel(row: MyAssignmentWithProgressRow): string {
  if (row.status === 'completed') return 'Concluído';
  if (row.total_steps === 0) {
    return row.quiz_passed ? 'Questionário aprovado' : 'Questionário pendente';
  }
  return `${row.completed_steps}/${row.total_steps} etapas${row.quiz_passed ? ' + Quiz aprovado' : ''}`;
}

function getStartLabel(row: MyAssignmentWithProgressRow): string {
  if (row.status === 'completed') return 'Ver curso';
  if (row.completed_steps > 0) return 'Continuar';
  return 'Iniciar curso';
}

export function CoursesEmployee() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<MyAssignmentWithProgressRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(STATUS_FILTER_ALL);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<StatusFilterValue>(STATUS_FILTER_ALL);

  const debouncedSearch = useDebouncedValue(searchQuery.trim().toLowerCase(), SEARCH_DEBOUNCE_MS);

  const loadAssignments = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, total } = await listMyAssignmentsWithProgress(user.id, {
        search: debouncedSearch || undefined,
        status: statusFilter === STATUS_FILTER_ALL ? undefined : statusFilter,
        limit: 500,
        offset: 0,
      });
      setAssignments(data);
      setTotalCount(total);
    } catch {
      toast.error('Erro ao carregar cursos.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleApplyFilters = () => {
    setStatusFilter(draftStatus);
    setFilterSheetOpen(false);
  };

  const handleClearFilters = () => {
    setDraftStatus(STATUS_FILTER_ALL);
    setStatusFilter(STATUS_FILTER_ALL);
    setSearchQuery('');
    setFilterSheetOpen(false);
  };

  const hasActiveFilters = statusFilter !== STATUS_FILTER_ALL || searchQuery.trim() !== '';
  const activeFiltersCount =
    (statusFilter !== STATUS_FILTER_ALL ? 1 : 0) + (searchQuery.trim() !== '' ? 1 : 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Meus Cursos
        </h1>
        <p className="text-muted-foreground mt-1">
          Cursos atribuídos a você. Conclua as etapas na ordem e realize o questionário final.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Buscar meus cursos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Buscar cursos"
          />
        </div>
        <Sheet
          open={filterSheetOpen}
          onOpenChange={(open) => {
            setFilterSheetOpen(open);
            if (open) setDraftStatus(statusFilter);
          }}
        >
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-fit">
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {hasActiveFilters && activeFiltersCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {activeFiltersCount > 99 ? '99+' : activeFiltersCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-sm">
            <SheetHeader className="border-b px-4 py-4">
              <SheetTitle>Aplicar Filtros</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 p-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Select
                  value={draftStatus}
                  onValueChange={(v) => setDraftStatus(v as StatusFilterValue)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_FILTER_ALL}>Todos</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="in_progress">Em progresso</SelectItem>
                    <SelectItem value="not_started">Não iniciados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleApplyFilters} className="flex-1">
                  Aplicar
                </Button>
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpar
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : totalCount === 0 && !hasActiveFilters ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum curso atribuído no momento.</p>
          </CardContent>
        </Card>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum curso corresponde à busca ou filtro.</p>
            <Button variant="outline" className="mt-4" onClick={handleClearFilters}>
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assignments.map((row) => (
            <CourseEmployeeCard
              key={row.assignment_id}
              course={rowToCourse(row)}
              progressLabel={getProgressLabel(row)}
              progressPercent={row.progress_pct}
              startLabel={getStartLabel(row)}
              onClick={() => navigate(`/courses/assignment/${row.assignment_id}/start`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
