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
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Plus, Search, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { listCourses, softDeleteCourse } from '@/services/courseService';
import type { Course } from '@/types/courses';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CourseEditor } from './CourseEditor';
import { CreateCourseDialog } from './CreateCourseDialog';
import { CourseAdminCard } from './CourseAdminCard';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const SEARCH_DEBOUNCE_MS = 300;
const COURSES_PAGE_SIZE = 9;
const COURSE_TYPE_FILTER_ALL = '__all__';

export function CoursesAdmin() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(COURSE_TYPE_FILTER_ALL);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [deleteConfirmCourse, setDeleteConfirmCourse] = useState<Course | null>(null);
  const [aiPlaceholderOpen, setAiPlaceholderOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchQuery.trim().toLowerCase(), SEARCH_DEBOUNCE_MS);
  const tenantId = user?.tenantId ?? '';

  const fetchCourses = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const { data, total } = await listCourses(tenantId, {
        search: debouncedSearch || undefined,
        type: typeFilter === COURSE_TYPE_FILTER_ALL ? undefined : (typeFilter as 'mandatory' | 'optional'),
        limit: COURSES_PAGE_SIZE,
        offset: (page - 1) * COURSES_PAGE_SIZE,
      });
      setCourses(data);
      setTotalCount(total);
    } catch {
      toast.error('Erro ao carregar cursos.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, debouncedSearch, typeFilter, page]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const totalPages = Math.max(1, Math.ceil(totalCount / COURSES_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1);
  }, [page, totalPages]);

  const handleCreateSuccess = (courseId: string) => {
    setCreateOpen(false);
    fetchCourses();
    setEditingCourseId(courseId);
  };

  const handleSoftDelete = async () => {
    const course = deleteConfirmCourse;
    if (!course) return;
    try {
      await softDeleteCourse(course.id);
      toast.success('Curso removido.');
      setDeleteConfirmCourse(null);
      setEditingCourseId((id) => (id === course.id ? null : id));
      fetchCourses();
    } catch {
      toast.error('Erro ao remover curso.');
    }
  };

  if (editingCourseId) {
    return (
      <CourseEditor
        courseId={editingCourseId}
        onClose={() => setEditingCourseId(null)}
        onSaved={() => {
          fetchCourses();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Cursos / Treinamentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie cursos, trilhas e questionários. Atribua aos colaboradores.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiPlaceholderOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Criar com IA
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo curso
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Cursos
          </CardTitle>
          <CardDescription>
            Lista de cursos do tenant. Busque, filtre e edite para configurar trilha e questionário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLoading && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Buscar por título ou descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Buscar cursos"
                />
              </div>
              <div className="flex items-center gap-2 sm:w-44">
                <Label htmlFor="course-type-filter" className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Tipo
                </Label>
                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                  <SelectTrigger id="course-type-filter">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COURSE_TYPE_FILTER_ALL}>Todos</SelectItem>
                    <SelectItem value="mandatory">Obrigatório</SelectItem>
                    <SelectItem value="optional">Opcional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : totalCount === 0 && !debouncedSearch && typeFilter === COURSE_TYPE_FILTER_ALL ? (
            <div className="py-12 text-center text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum curso ainda.</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                Criar primeiro curso
              </Button>
            </div>
          ) : courses.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>Nenhum curso corresponde à busca ou filtro.</p>
              <Button variant="outline" className="mt-4" onClick={() => { setSearchQuery(''); setTypeFilter(COURSE_TYPE_FILTER_ALL); setPage(1); }}>
                Limpar filtros
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <CourseAdminCard
                    key={course.id}
                    course={course}
                    onEdit={() => setEditingCourseId(course.id)}
                    onRemove={() => setDeleteConfirmCourse(course)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="mt-6 flex items-center justify-center gap-1" aria-label="Navegação de páginas">
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
                </nav>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateCourseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tenantId={tenantId}
        createdBy={user?.id ?? null}
        onSuccess={handleCreateSuccess}
      />

      <Dialog open={aiPlaceholderOpen} onOpenChange={setAiPlaceholderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Criar curso com IA
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Em breve você poderá gerar cursos a partir de um tema ou de um PDF com assistência de IA. Esta funcionalidade será disponibilizada em uma atualização futura.
          </p>
          <DialogFooter>
            <Button onClick={() => setAiPlaceholderOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmCourse} onOpenChange={(open) => !open && setDeleteConfirmCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover curso?</AlertDialogTitle>
            <AlertDialogDescription>
              O curso &quot;{deleteConfirmCourse?.title}&quot; será removido. Os progressos e tentativas de questionário já realizados permanecem no histórico. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSoftDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
