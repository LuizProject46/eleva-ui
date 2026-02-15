import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { listCourses } from '@/services/courseService';
import { listCourseAssignmentsAdminProgress } from '@/services/courseAssignmentService';
import type { Course } from '@/types/courses';
import type { CourseAssignmentProgressRow } from '@/types/courses';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;
const STATUS_ALL = '__all__';
const COURSE_ALL = '__all__';

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em progresso',
  completed: 'Concluído',
};

function formatCompletedAt(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

const CIRCLE_SIZE = 45;
const CIRCLE_STROKE = 4;
const CIRCLE_R = (CIRCLE_SIZE - CIRCLE_STROKE) / 2;
const CIRCLE_CX = CIRCLE_SIZE / 2;
const CIRCLE_CY = CIRCLE_SIZE / 2;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

function CircleProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const offset = CIRCLE_CIRCUMFERENCE * (1 - pct / 100);
  return (
    <div
      className="relative inline-flex shrink-0"
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
      title={`${value}%`}
    >
      <svg
        width={CIRCLE_SIZE}
        height={CIRCLE_SIZE}
        className="absolute inset-0 rotate-[-90deg]"
        aria-hidden
      >
        <circle
          cx={CIRCLE_CX}
          cy={CIRCLE_CY}
          r={CIRCLE_R}
          fill="none"
          stroke="currentColor"
          strokeWidth={CIRCLE_STROKE}
          className="text-muted-foreground/40"
        />
        <circle
          cx={CIRCLE_CX}
          cy={CIRCLE_CY}
          r={CIRCLE_R}
          fill="none"
          stroke="currentColor"
          strokeWidth={CIRCLE_STROKE}
          strokeDasharray={CIRCLE_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums text-foreground">
        {pct}%
      </span>
    </div>
  );
}

export function CourseProgressGrid() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CourseAssignmentProgressRow[]>([]);
  const [total, setTotal] = useState(0);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_ALL);
  const [courseFilter, setCourseFilter] = useState<string>(COURSE_ALL);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
  const tenantId = user?.tenantId ?? '';

  const fetchCourses = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await listCourses(tenantId, { limit: 500 });
      setCourses(data);
    } catch {
      toast.error('Erro ao carregar cursos.');
    }
  }, [tenantId]);

  const fetchProgress = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const { data: list, total: totalCount } = await listCourseAssignmentsAdminProgress({
        search: debouncedSearch || undefined,
        status: statusFilter === STATUS_ALL ? undefined : statusFilter,
        courseId: courseFilter === COURSE_ALL ? undefined : courseFilter,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setRows(list);
      setTotal(totalCount);
    } catch {
      toast.error('Erro ao carregar progresso.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, debouncedSearch, statusFilter, courseFilter, page]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, courseFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1);
  }, [page, totalPages]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Progresso dos colaboradores
        </h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe o andamento dos cursos por colaborador. Use busca e filtros para encontrar registros.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Atribuições e progresso
          </CardTitle>
          <CardDescription>
            Filtre por colaborador, status ou curso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Buscar por nome ou curso..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Buscar"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2 w-full sm:w-40">
                <Label htmlFor="progress-status-filter" className="sr-only sm:not-sr-only">
                  Status
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="progress-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATUS_ALL}>Todos</SelectItem>
                    <SelectItem value="not_started">{STATUS_LABELS.not_started}</SelectItem>
                    <SelectItem value="in_progress">{STATUS_LABELS.in_progress}</SelectItem>
                    <SelectItem value="completed">{STATUS_LABELS.completed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-full sm:w-48">
                <Label htmlFor="progress-course-filter" className="sr-only sm:not-sr-only">
                  Curso
                </Label>
                <Select
                  value={courseFilter}
                  onValueChange={(v) => {
                    setCourseFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="progress-course-filter">
                    <SelectValue placeholder="Curso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COURSE_ALL}>Todos os cursos</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma atribuição corresponde aos filtros.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="hidden sm:table-cell">Setor</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progresso</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Etapas</TableHead>
                    <TableHead className="hidden lg:table-cell">Concluído em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.assignment_id}>
                      <TableCell className="font-medium">{row.user_name}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {row.user_department ?? '—'}
                      </TableCell>
                      <TableCell>{row.course_title}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === 'completed'
                              ? 'default'
                              : row.status === 'in_progress'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <CircleProgressBar value={row.progress_pct} />
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground hidden md:table-cell tabular-nums">
                        {row.completed_steps}/{row.total_steps}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {formatCompletedAt(row.completed_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {!isLoading && rows.length > 0 && totalPages > 1 && (
            <nav
              className="flex items-center justify-between gap-2 flex-wrap"
              aria-label="Navegação de páginas"
            >
              <p className="text-sm text-muted-foreground">
                {total} registro{total !== 1 ? 's' : ''} no total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
