import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { assignCourseToUsers, unassignCourse, getCourseAssignmentsAdminList } from '@/services/courseAssignmentService';
import type { CourseAssignmentAdminRow, CourseType } from '@/types/courses';

const DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 10;

interface ProfileOption {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

/** Escape % and _ for safe use in ilike patterns. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em progresso',
  completed: 'Concluído',
};

interface CourseAssignmentsProps {
  courseId: string;
  courseType: CourseType;
  assignments: CourseAssignmentAdminRow[];
  onUpdate: () => void;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function CourseAssignments({ courseId, courseType, assignments, onUpdate }: CourseAssignmentsProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [assignAllConfirmOpen, setAssignAllConfirmOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchQuery, DEBOUNCE_MS);
  const tenantId = user?.tenantId ?? '';

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('profiles')
      .select('department')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (error || !data) return;
        const list = [...new Set((data as { department: string | null }[]).map((r) => r.department).filter(Boolean))] as string[];
        setDepartments(list.sort());
      });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setIsSearchingProfiles(true);
    const run = async () => {
      let query = supabase
        .from('profiles')
        .select('id, name, email, department')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name')
        .limit(SEARCH_LIMIT);

      if (departmentFilter) {
        query = query.eq('department', departmentFilter);
      }
      const q = debouncedSearch.trim().replace(/,/g, ' ');
      if (q) {
        const pattern = `%${escapeIlike(q)}%`;
        query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
      }

      const { data, error } = await query;
      if (!cancelled && !error && data) {
        setProfiles(data as ProfileOption[]);
      }
      if (!cancelled) setIsSearchingProfiles(false);
    };
    run();
    return () => { cancelled = true; };
  }, [tenantId, debouncedSearch, departmentFilter]);

  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.user_id)), [assignments]);

  const availableProfiles = useMemo(
    () => profiles.filter((p) => !assignedIds.has(p.id)),
    [profiles, assignedIds]
  );

  const selectedCount = selectedIds.size;
  const selectedAvailable = useMemo(
    () => availableProfiles.filter((p) => selectedIds.has(p.id)),
    [availableProfiles, selectedIds]
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      availableProfiles.forEach((p) => next.add(p.id));
      return next;
    });
  }, [availableProfiles]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAssignSelected = async () => {
    if (selectedAvailable.length === 0 || !user?.id) return;
    setAssigning(true);
    const userIds = selectedAvailable.map((p) => p.id);
    try {
      await assignCourseToUsers(courseId, userIds, user.id);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        for (const userId of userIds) {
          await supabase.functions.invoke('send-mandatory-course-email', {
            body: { user_id: userId, course_id: courseId },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      }
      toast.success(
        selectedAvailable.length === 1
          ? 'Colaborador atribuído.'
          : `${selectedAvailable.length} colaboradores atribuídos.`
      );
      setSelectedIds(new Set());
      onUpdate();
    } catch {
      toast.error('Erro ao atribuir.');
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignAll = async () => {
    if (availableProfiles.length === 0 || !user?.id) return;
    setAssigning(true);
    setAssignAllConfirmOpen(false);
    const userIds = availableProfiles.map((p) => p.id);
    try {
      await assignCourseToUsers(courseId, userIds, user.id);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        for (const userId of userIds) {
          await supabase.functions.invoke('send-mandatory-course-email', {
            body: { user_id: userId, course_id: courseId },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      }
      toast.success(
        availableProfiles.length === 1
          ? 'Colaborador atribuído.'
          : `${availableProfiles.length} colaboradores atribuídos.`
      );
      setSelectedIds(new Set());
      onUpdate();
    } catch {
      toast.error('Erro ao atribuir.');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    setUnassigningId(assignmentId);
    try {
      await unassignCourse(assignmentId);
      toast.success('Atribuição removida.');
      onUpdate();
    } catch {
      toast.error('Erro ao remover.');
    } finally {
      setUnassigningId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Atribuições
        </CardTitle>
        <CardDescription>
          Colaboradores que devem realizar este curso. Filtre por setor ou nome e atribua em lote.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="space-y-2 sm:w-48">
            <Label htmlFor="assign-dept">Setor</Label>
            <Select value={departmentFilter || '__all__'} onValueChange={(v) => setDepartmentFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger id="assign-dept">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os setores</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 min-w-0 sm:min-w-[200px]">
            <Label htmlFor="assign-search">Buscar por nome ou e-mail</Label>
            <Input
              id="assign-search"
              type="search"
              placeholder="Digite para buscar (máx. 10 resultados)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium">
              Colaboradores {isSearchingProfiles ? '(buscando...)' : `(até ${SEARCH_LIMIT} por busca)`}
            </span>
            <div className="flex gap-2">
              {availableProfiles.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllPage}
                  >
                    Selecionar todos nesta página
                  </Button>
                  {selectedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                      Desmarcar todos
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <ScrollArea className="h-[200px] rounded-md border p-2">
            {isSearchingProfiles ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Buscando...</p>
            ) : availableProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {profiles.length === 0
                  ? 'Use os filtros e a busca para encontrar colaboradores (até 10 por vez).'
                  : 'Todos os colaboradores desta busca já estão atribuídos.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {availableProfiles.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`assign-${p.id}`}
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => handleToggleSelect(p.id)}
                    />
                    <Label
                      htmlFor={`assign-${p.id}`}
                      className="flex-1 text-sm font-normal cursor-pointer"
                    >
                      {p.name}
                      {p.department && (
                        <span className="text-muted-foreground ml-1">({p.department})</span>
                      )}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
                </span>
                <Button
                  onClick={handleAssignSelected}
                  disabled={assigning}
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Atribuir selecionados
                </Button>
              </div>
            )}
            {availableProfiles.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setAssignAllConfirmOpen(true)}
                disabled={assigning}
                className="gap-2 w-fit"
              >
                <Users className="w-4 h-4" />
                Atribuir a todos os colaboradores do filtro ({availableProfiles.length})
              </Button>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Atribuídos a este curso</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((row) => (
                <TableRow key={row.assignment_id}>
                  <TableCell>
                    <div className="font-medium">{row.user_name}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.user_department ?? '—'}</TableCell>
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleUnassign(row.assignment_id)}
                      disabled={unassigningId === row.assignment_id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {assignments.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Nenhum colaborador atribuído ainda.</p>
          )}
        </div>
      </CardContent>

      <AlertDialog open={assignAllConfirmOpen} onOpenChange={setAssignAllConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atribuir a todos?</AlertDialogTitle>
            <AlertDialogDescription>
              {availableProfiles.length} colaborador(es) será(ão) atribuído(s) a este curso
              {departmentFilter || debouncedSearch ? ' (conforme o filtro aplicado)' : ''}.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssignAll} disabled={assigning}>
              Atribuir todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
