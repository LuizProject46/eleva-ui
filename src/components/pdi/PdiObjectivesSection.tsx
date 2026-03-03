import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createObjective,
  updateObjective,
  deleteObjective,
  createAction,
  updateAction,
  deleteAction,
  updateActionStatus,
} from '@/services/pdiService';
import type { Pdi, PdiObjective, PdiAction, PdiObjectiveStatus } from '@/types/pdi';
import { AsyncSearchCombobox } from '@/components/async/AsyncSearchCombobox';
import type { AsyncSearchOption } from '@/components/async/AsyncSearchCombobox';
import { useAuth } from '@/contexts/AuthContext';

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const OBJECTIVE_STATUS_LABELS: Record<PdiObjectiveStatus, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  course: 'Curso',
  practice: 'Prática',
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
};

interface PdiObjectivesSectionProps {
  pdi: Pdi;
  objectives: PdiObjective[];
  actions: PdiAction[];
  onUpdate: () => void;
  canManage: boolean;
}

export function PdiObjectivesSection({ pdi, objectives, actions, onUpdate, canManage }: PdiObjectivesSectionProps) {
  const [openObjectiveId, setOpenObjectiveId] = useState<string | null>(null);
  const [objectiveDialog, setObjectiveDialog] = useState<'add' | 'edit' | null>(null);
  const [actionDialog, setActionDialog] = useState<{ objectiveId: string } | null>(null);
  const [editingObjective, setEditingObjective] = useState<PdiObjective | null>(null);
  const [defaultResponsibleLabel, setDefaultResponsibleLabel] = useState<string>('');

  const canEdit =
    canManage && (pdi.status === 'draft' || pdi.status === 'in_approval' || pdi.status === 'active');

  const actionsByObjective = actions.reduce<Record<string, PdiAction[]>>((acc, a) => {
    if (!acc[a.pdi_objective_id]) acc[a.pdi_objective_id] = [];
    acc[a.pdi_objective_id].push(a);
    return acc;
  }, {});

  useEffect(() => {
    if (!pdi.employee_id) return;
    supabase
      .from('profiles')
      .select('name')
      .eq('id', pdi.employee_id)
      .maybeSingle()
      .then(({ data }) => {
        setDefaultResponsibleLabel((data as { name?: string } | null)?.name ?? '');
      });
  }, [pdi.employee_id]);

  const handleOpenActionDialog = (objectiveId: string) => {
    setActionDialog({ objectiveId });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Objetivos e planos de ação</h2>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditingObjective(null);
              setObjectiveDialog('add');
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Objetivo
          </Button>
        )}
      </div>

      {objectives.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum objetivo cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {objectives.map((obj) => {
            const objActions = actionsByObjective[obj.id] ?? [];
            const completedCount = objActions.filter((a) => a.status === 'completed').length;
            const totalCount = objActions.length;
            const completedActions = objActions.filter((a) => a.status === 'completed');
            const objStatus = obj.status ?? 'not_started';
            return (
            <Collapsible
              key={obj.id}
              open={openObjectiveId === obj.id}
              onOpenChange={(open) => setOpenObjectiveId(open ? obj.id : null)}
            >
              <div className="rounded-lg border border-border overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            objStatus === 'completed'
                              ? 'bg-primary/10 text-primary'
                              : objStatus === 'in_progress'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {OBJECTIVE_STATUS_LABELS[objStatus]}
                        </span>
                        {totalCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Planos de ação: {completedCount}/{totalCount} concluídos
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-foreground">{obj.description}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {obj.competency && `Competência: ${obj.competency} · `}
                        {obj.priority && `${PRIORITY_LABELS[obj.priority] ?? obj.priority} · `}
                        {obj.due_date && `Até ${new Date(obj.due_date).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                                      {canEdit && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingObjective(obj);
                                              setObjectiveDialog('edit');
                                            }}
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (!confirm('Excluir este objetivo e suas ações?')) return;
                                              try {
                                                await deleteObjective(obj.id);
                                                toast.success('Objetivo excluído.');
                                                onUpdate();
                                              } catch {
                                                toast.error('Erro ao excluir.');
                                              }
                                            }}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </>
                                      )}
                                      <ChevronDown
                                        className={`w-4 h-4 transition-transform ${openObjectiveId === obj.id ? 'rotate-180' : ''}`}
                                      />
                                    </div>
                                  </button>
                                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border p-4 bg-muted/20">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Planos de ação</p>
                    {completedActions.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Concluídos</p>
                        <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
                          {completedActions.map((a) => (
                            <li key={a.id}>{a.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(actionsByObjective[obj.id]?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground mb-2">Nenhum plano de ação.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead>Prazo</TableHead>
                            <TableHead>Status</TableHead>
                            {canEdit && <TableHead className="w-[80px]">Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(actionsByObjective[obj.id] ?? []).map((action) => (
                            <PdiActionRow
                              key={action.id}
                              action={action}
                              canEdit={canEdit}
                              onStatusChange={async (status) => {
                                await updateActionStatus(action.id, status);
                                onUpdate();
                              }}
                              onDelete={async () => {
                                await deleteAction(action.id);
                                toast.success('Ação excluída.');
                                onUpdate();
                              }}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleOpenActionDialog(obj.id)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Plano de ação
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
            );
          })}
        </div>
      )}

      <ObjectiveDialog
        pdi={pdi}
        mode={objectiveDialog}
        editing={editingObjective}
        onClose={() => {
          setObjectiveDialog(null);
          setEditingObjective(null);
        }}
        onSuccess={() => {
          onUpdate();
          setObjectiveDialog(null);
          setEditingObjective(null);
        }}
      />

      <ActionDialog
        pdi={pdi}
        objectiveId={actionDialog?.objectiveId ?? null}
        defaultResponsible={{
          id: pdi.employee_id,
          label: defaultResponsibleLabel,
        }}
        onClose={() => setActionDialog(null)}
        onSuccess={() => {
          onUpdate();
          setActionDialog(null);
        }}
      />
    </div>
  );
}

function PdiActionRow({
  action,
  canEdit,
  onStatusChange,
  onDelete,
}: {
  action: PdiAction;
  canEdit: boolean;
  onStatusChange: (status: PdiAction['status']) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [authorName, setAuthorName] = useState<string>('');

  useEffect(() => {
    supabase.from('profiles').select('name').eq('id', action.responsible_user_id).maybeSingle().then(({ data }) => {
      setAuthorName((data as { name?: string } | null)?.name ?? '');
    });
  }, [action.responsible_user_id]);

  return (
    <TableRow>
      <TableCell className="font-medium">{action.description}</TableCell>
      <TableCell>{ACTION_TYPE_LABELS[action.type] ?? action.type}</TableCell>
      <TableCell>{authorName || action.responsible_user_id}</TableCell>
      <TableCell>{action.due_date ? new Date(action.due_date).toLocaleDateString('pt-BR') : '—'}</TableCell>
      <TableCell>
        {action.type === 'course' && action.status === 'completed' && (
          <span className="text-xs text-muted-foreground">Concluído pelo curso</span>
        )}
        {canEdit && !(action.type === 'course' && action.status === 'completed') ? (
          <Select
            value={action.status}
            onValueChange={(v) => void onStatusChange(v as PdiAction['status'])}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTION_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          ACTION_STATUS_LABELS[action.status] ?? action.status
        )}
      </TableCell>
      {canEdit && (
        <TableCell>
          <Button variant="ghost" size="icon" onClick={() => void onDelete()}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

function ObjectiveDialog({
  pdi,
  mode,
  editing,
  onClose,
  onSuccess,
}: {
  pdi: Pdi;
  mode: 'add' | 'edit' | null;
  editing: PdiObjective | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [description, setDescription] = useState('');
  const [competency, setCompetency] = useState('');
  const [priority, setPriority] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<PdiObjectiveStatus>('not_started');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = mode !== null;
  const isEdit = mode === 'edit' && editing;

  useEffect(() => {
    if (open && isEdit && editing) {
      setDescription(editing.description);
      setCompetency(editing.competency ?? '');
      setPriority(editing.priority ?? '');
      setDueDate(editing.due_date ?? '');
      setStatus((editing.status as PdiObjectiveStatus) ?? 'not_started');
    } else if (open && !isEdit) {
      setDescription('');
      setCompetency('');
      setPriority('');
      setDueDate('');
      setStatus('not_started');
    }
  }, [open, isEdit, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Informe a descrição.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit && editing) {
        await updateObjective(editing.id, {
          description: description.trim(),
          competency: competency.trim() || null,
          priority: (priority as PdiObjective['priority']) || null,
          due_date: dueDate || null,
          status,
        });
        toast.success('Objetivo atualizado.');
      } else {
        await createObjective({
          pdi_id: pdi.id,
          description: description.trim(),
          competency: competency.trim() || null,
          priority: (priority as PdiObjective['priority']) || null,
          due_date: dueDate || null,
          position: 0,
          status,
        });
        toast.success('Objetivo criado.');
      }
      onSuccess();
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar objetivo' : 'Novo objetivo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="obj-desc">Descrição</Label>
            <Input
              id="obj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obj-comp">Competência (opcional)</Label>
            <Input
              id="obj-comp"
              value={competency}
              onChange={(e) => setCompetency(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status do objetivo</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PdiObjectiveStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(OBJECTIVE_STATUS_LABELS) as [PdiObjectiveStatus, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="obj-due">Prazo (opcional)</Label>
            <Input
              id="obj-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActionDialog({
  pdi,
  objectiveId,
  defaultResponsible,
  onClose,
  onSuccess,
}: {
  pdi: Pdi;
  objectiveId: string | null;
  defaultResponsible: AsyncSearchOption | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PdiAction['type']>('practice');
  const [responsible, setResponsible] = useState<AsyncSearchOption | null>(defaultResponsible);
  const [dueDate, setDueDate] = useState('');
  const [courseAssignment, setCourseAssignment] = useState<AsyncSearchOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = objectiveId !== null;

  useEffect(() => {
    if (open && defaultResponsible) {
      setResponsible(defaultResponsible);
      setDescription('');
      setType('practice');
      setDueDate('');
      setCourseAssignment(null);
    }
  }, [open, defaultResponsible]);

  const searchEmployees = useCallback(
    async (query: string): Promise<AsyncSearchOption[]> => {
      let q = supabase
        .from('profiles')
        .select('id, name')
        .eq('tenant_id', pdi.tenant_id)
        .eq('is_active', true)
        .order('name')
        .limit(20);
      if (query.trim()) {
        q = q.ilike('name', `%${query.trim()}%`);
      }
      if (user?.role === 'manager' && user?.id) {
        q = q.eq('manager_id', user.id);
      }
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map((r) => ({ id: r.id, label: r.name ?? '' }));
    },
    [pdi.tenant_id, user?.role, user?.id]
  );

  const searchCourseAssignments = useCallback(
    async (userId: string, query: string): Promise<AsyncSearchOption[]> => {
      if (user?.role === 'manager' && user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('manager_id')
          .eq('id', userId)
          .maybeSingle();
        if ((profile as { manager_id?: string } | null)?.manager_id !== user.id) {
          return [];
        }
      }
      const { data: assignments } = await supabase
        .from('course_assignments')
        .select('id, course_id')
        .eq('user_id', userId);
      const list = assignments ?? [];
      if (list.length === 0) return [];
      const courseIds = [...new Set(list.map((a) => a.course_id))];
      let coursesQuery = supabase
        .from('courses')
        .select('id, title')
        .in('id', courseIds)
        .limit(20);
      if (query.trim()) {
        coursesQuery = coursesQuery.ilike('title', `%${query.trim()}%`);
      }
      const { data: courses } = await coursesQuery;
      const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title ?? '']));
      return list
        .filter((a) => courseMap.has(a.course_id))
        .map((a) => ({ id: a.id, label: courseMap.get(a.course_id) ?? 'Curso' }))
        .slice(0, 20);
    },
    [user?.role, user?.id]
  );

  const handleTypeChange = (t: PdiAction['type']) => {
    setType(t);
    if (t !== 'course') setCourseAssignment(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectiveId || !description.trim() || !responsible?.id) {
      toast.error('Preencha descrição e responsável.');
      return;
    }
    if (type === 'course' && !courseAssignment?.id) {
      toast.error('Selecione o curso atribuído.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createAction({
        pdi_objective_id: objectiveId,
        description: description.trim(),
        type,
        responsible_user_id: responsible.id,
        due_date: dueDate || null,
        course_assignment_id: type === 'course' ? courseAssignment?.id ?? null : null,
      });
      toast.success('Ação criada.');
      onSuccess();
    } catch {
      toast.error('Erro ao criar ação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova ação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="act-desc">Descrição</Label>
            <Input id="act-desc" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => handleTypeChange(v as PdiAction['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <AsyncSearchCombobox
              value={responsible}
              onValueChange={(v) => {
                setResponsible(v);
                if (type === 'course') setCourseAssignment(null);
              }}
              onSearch={searchEmployees}
              placeholder="Selecione o responsável"
              searchPlaceholder="Buscar por nome..."
              emptyMessage="Nenhum encontrado."
            />
          </div>
          {type === 'course' && (
            <div className="space-y-2">
              <Label>Curso atribuído</Label>
              <AsyncSearchCombobox
                value={courseAssignment}
                onValueChange={setCourseAssignment}
                onSearch={(query) => (responsible?.id ? searchCourseAssignments(responsible.id, query) : Promise.resolve([]))}
                placeholder={responsible?.id ? 'Selecione o curso' : 'Selecione o responsável antes'}
                searchPlaceholder="Buscar por curso..."
                emptyMessage="Nenhum curso encontrado."
                disabled={!responsible?.id}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="act-due">Prazo (opcional)</Label>
            <Input id="act-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Criando...' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
