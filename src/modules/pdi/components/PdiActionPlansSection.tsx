import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ACTION_PLAN_TYPE_OPTIONS, ACTION_PLAN_TYPE_LABELS } from '@/constants/actionPlanTypes';
import type { ActionPlanType } from '@/constants/actionPlanTypes';
import { Check, ChevronDown, Circle, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { PdiEvidenceUploader } from '@/modules/pdi/components/PdiEvidenceUploader';
import type { Pdi, PdiActionPlan, PdiPlanAction, PdiEvidence } from '@/types/pdi';

function computePlanProgress(actions: PdiPlanAction[]): {
  progressPct: number;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean;
} {
  const totalCount = actions.length;
  const completedCount = actions.filter((a) => a.completed).length;
  const progressPct = totalCount > 0 ? Math.round((100 * completedCount) / totalCount) : 0;
  const isCompleted = totalCount > 0 && completedCount === totalCount;
  return { progressPct, completedCount, totalCount, isCompleted };
}

function getTodayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DELIVERY_DATE_PAST_MESSAGE = 'A data de entrega não pode ser no passado.';

/** Formats a YYYY-MM-DD date string to pt-BR (DD/MM/YYYY) without timezone shift. */
function formatDeliveryDate(isoDate: string): string {
  if (!isoDate?.trim()) return '';
  const [y, m, d] = isoDate.trim().split('-');
  if (!d || !m || !y) return isoDate;
  return `${d}/${m}/${y}`;
}

interface PdiActionPlansSectionProps {
  pdi: Pdi;
  actionPlans: PdiActionPlan[];
  planActions: PdiPlanAction[];
  createdByNames?: Record<string, string>;
  canEdit: boolean;
  canUploadEvidence: boolean;
  evidencesByPlanActionId: Record<string, PdiEvidence[]>;
  evidencesByActionPlanId: Record<string, PdiEvidence[]>;
  onUploadPlanEvidence: (payload: { pdiActionPlanId: string; file: File }) => Promise<void>;
  onUploadTaskEvidence: (payload: { pdiPlanActionId: string; file: File }) => Promise<void>;
  currentUserId: string;
  isSavingPlan?: boolean;
  isSavingAction?: boolean;
  isUpdatingAction?: boolean;
  updatingActionId?: string | null;
  isDeletingPlan?: boolean;
  isDeletingAction?: boolean;
  onCreatePlan: (payload: {
    pdi_id: string;
    type: string;
    delivery_date: string;
    description: string;
    position: number;
    created_by: string;
  }) => Promise<void>;
  onUpdatePlan: (planId: string, updates: { type?: string; delivery_date?: string; description?: string }) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
  onCreateAction: (payload: { pdi_action_plan_id: string; description: string }) => Promise<void>;
  onUpdateAction: (actionId: string, updates: { description?: string; completed?: boolean }) => Promise<void>;
  onDeleteAction: (actionId: string) => Promise<void>;
}

export function PdiActionPlansSection({
  pdi,
  actionPlans,
  planActions,
  createdByNames = {},
  canEdit,
  canUploadEvidence,
  evidencesByPlanActionId,
  evidencesByActionPlanId,
  onUploadPlanEvidence,
  onUploadTaskEvidence,
  currentUserId,
  isSavingPlan = false,
  isSavingAction = false,
  isUpdatingAction = false,
  updatingActionId = null,
  isDeletingPlan = false,
  isDeletingAction = false,
  onCreatePlan,
  onUpdatePlan,
  onDeletePlan,
  onCreateAction,
  onUpdateAction,
  onDeleteAction,
}: PdiActionPlansSectionProps) {
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [planDialog, setPlanDialog] = useState<'add' | 'edit' | null>(null);
  const [actionDialogPlanId, setActionDialogPlanId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PdiActionPlan | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deleteActionId, setDeleteActionId] = useState<string | null>(null);

  const actionsByPlanId = useMemo(() => {
    return planActions.reduce<Record<string, PdiPlanAction[]>>((acc, a) => {
      const planId = a.pdi_action_plan_id;
      if (!acc[planId]) acc[planId] = [];
      acc[planId].push(a);
      return acc;
    }, {});
  }, [planActions]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Planos de ação</h2>
        {canEdit && (
          <Button
            size="sm"
            disabled={isSavingPlan}
            onClick={() => {
              setEditingPlan(null);
              setPlanDialog('add');
            }}
          >
            {isSavingPlan ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar plano
              </>
            )}
          </Button>
        )}
      </div>

      {actionPlans.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Nenhum plano de ação cadastrado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {actionPlans.map((plan) => {
            const planActionsList = actionsByPlanId[plan.id] ?? [];
            const { progressPct, completedCount, totalCount, isCompleted } =
              computePlanProgress(planActionsList);
            const typeLabel =
              ACTION_PLAN_TYPE_LABELS[plan.type as ActionPlanType] ?? plan.type;
            const ownerName = plan.created_by
              ? createdByNames[plan.created_by] ?? null
              : null;

            return (
              <Collapsible
                key={plan.id}
                open={openPlanId === plan.id}
                onOpenChange={(open) => setOpenPlanId(open ? plan.id : null)}
              >
                <Card>
                  <CardHeader className="p-4 md:p-5 pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity rounded-md -m-2 p-2"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground">
                              {typeLabel}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                isCompleted
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isCompleted ? 'Concluído' : 'Em andamento'}
                            </span>
                          </div>
                          <p className="font-medium text-foreground">
                            {plan.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                            {ownerName && (
                              <span>Responsável: {ownerName}</span>
                            )}
                            <span>
                              Entrega:{' '}
                              {formatDeliveryDate(plan.delivery_date)}
                            </span>
                            {totalCount > 0 && (
                              <span>
                                {completedCount}/{totalCount} concluídas
                              </span>
                            )}
                          </div>
                          {totalCount > 0 && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Progresso</span>
                                <span>{progressPct}%</span>
                              </div>
                              <Progress value={progressPct} className="h-2" />
                            </div>
                          )}
                          <ChevronDown
                            className={`mt-2 w-4 h-4 shrink-0 transition-transform ${
                              openPlanId === plan.id ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isSavingPlan || isDeletingPlan}
                            onClick={() => {
                              setEditingPlan(plan);
                              setPlanDialog('edit');
                            }}
                            aria-label="Editar plano"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isSavingPlan || isDeletingPlan}
                            onClick={() => setDeletePlanId(plan.id)}
                            aria-label="Excluir plano"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <div className="border-t border-border p-4 md:p-5 pt-4 bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Tarefas
                        </p>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSavingAction}
                            onClick={() => setActionDialogPlanId(plan.id)}
                          >
                            {isSavingAction ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Adicionando...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-1" />
                                Adicionar tarefa
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {planActionsList.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma tarefa ainda.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {planActionsList.map((action) => {
                            const isThisActionUpdating =
                              updatingActionId === action.id;
                            return (
                              <li
                                key={action.id}
                                className="flex items-start gap-3 rounded-md border border-border bg-background p-3"
                              >
                                {canEdit ? (
                                  isThisActionUpdating ? (
                                    <Loader2
                                      className="h-4 w-4 shrink-0 animate-spin text-muted-foreground mt-0.5"
                                      aria-label="Salvando..."
                                    />
                                  ) : (
                                    <Checkbox
                                      id={`action-${action.id}`}
                                      checked={action.completed}
                                      disabled={isUpdatingAction}
                                      onCheckedChange={(checked) => {
                                        void onUpdateAction(action.id, {
                                          completed: checked === true,
                                        });
                                      }}
                                      className="mt-0.5"
                                    />
                                  )
                                ) : action.completed ? (
                                  <Check
                                    className="h-4 w-4 shrink-0 text-primary mt-0.5"
                                    aria-hidden
                                  />
                                ) : (
                                  <Circle
                                    className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5"
                                    aria-hidden
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  {canEdit && !isThisActionUpdating ? (
                                    <label
                                      htmlFor={`action-${action.id}`}
                                      className={`text-sm cursor-pointer ${
                                        action.completed
                                          ? 'text-muted-foreground line-through'
                                          : 'text-foreground'
                                      }`}
                                    >
                                      {action.description}
                                    </label>
                                  ) : (
                                    <span
                                      className={`text-sm ${
                                        action.completed
                                          ? 'text-muted-foreground line-through'
                                          : 'text-foreground'
                                      }`}
                                    >
                                      {action.description}
                                    </span>
                                  )}

                                  {(canUploadEvidence || (evidencesByPlanActionId[action.id]?.length ?? 0) > 0) && (
                                    <div className="mt-3">
                                      <PdiEvidenceUploader
                                        label="Evidência"
                                        canUpload={canUploadEvidence}
                                        evidences={evidencesByPlanActionId[action.id] ?? []}
                                        onUploadEvidence={(file) =>
                                          onUploadTaskEvidence({ pdiPlanActionId: action.id, file })
                                        }
                                      />
                                    </div>
                                  )}
                                </div>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 h-8 w-8"
                                    disabled={
                                      isUpdatingAction || isDeletingAction
                                    }
                                    onClick={() => setDeleteActionId(action.id)}
                                    aria-label="Excluir tarefa"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {(canUploadEvidence || (evidencesByActionPlanId[plan.id]?.length ?? 0) > 0) && (
                        <div className="pt-4">
                          <PdiEvidenceUploader
                            label="Evidência do plano"
                            canUpload={canUploadEvidence}
                            evidences={evidencesByActionPlanId[plan.id] ?? []}
                            onUploadEvidence={(file) =>
                              onUploadPlanEvidence({ pdiActionPlanId: plan.id, file })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      <ActionPlanDialog
        mode={planDialog}
        editing={editingPlan}
        isSaving={isSavingPlan}
        onClose={() => {
          setPlanDialog(null);
          setEditingPlan(null);
        }}
        onSubmit={async (payload) => {
          if (planDialog === 'edit' && editingPlan) {
            await onUpdatePlan(editingPlan.id, {
              type: payload.type,
              delivery_date: payload.delivery_date,
              description: payload.description,
            });
          } else {
            await onCreatePlan({
              pdi_id: pdi.id,
              type: payload.type,
              delivery_date: payload.delivery_date,
              description: payload.description,
              position: actionPlans.length,
              created_by: currentUserId,
            });
          }
          setPlanDialog(null);
          setEditingPlan(null);
        }}
      />

      <AlertDialog open={deletePlanId !== null} onOpenChange={(open) => !open && setDeletePlanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano de ação?</AlertDialogTitle>
            <AlertDialogDescription>
              Este plano de ação e todas as tarefas serão excluídos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPlan}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeletingPlan}
              onClick={async () => {
                if (!deletePlanId) return;
                try {
                  await onDeletePlan(deletePlanId);
                  toast.success('Removido.');
                  setDeletePlanId(null);
                } catch {
                  toast.error('Erro ao excluir.');
                }
              }}
            >
              {isDeletingPlan ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteActionId !== null} onOpenChange={(open) => !open && setDeleteActionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta tarefa será excluída. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAction}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeletingAction}
              onClick={async () => {
                if (!deleteActionId) return;
                try {
                  await onDeleteAction(deleteActionId);
                  toast.success('Removido.');
                  setDeleteActionId(null);
                } catch {
                  toast.error('Erro ao excluir.');
                }
              }}
            >
              {isDeletingAction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddActionDialog
        planId={actionDialogPlanId}
        isSaving={isSavingAction}
        onClose={() => setActionDialogPlanId(null)}
        onSubmit={async (description) => {
          if (!actionDialogPlanId) return;
          await onCreateAction({
            pdi_action_plan_id: actionDialogPlanId,
            description,
          });
          setActionDialogPlanId(null);
        }}
      />
    </section>
  );
}

function ActionPlanDialog({
  mode,
  editing,
  isSaving = false,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit' | null;
  editing: PdiActionPlan | null;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    type: string;
    delivery_date: string;
    description: string;
  }) => Promise<void>;
}) {
  const open = mode !== null;
  const isEdit = mode === 'edit' && editing;

  const [type, setType] = useState<string>(ACTION_PLAN_TYPE_OPTIONS[0].value);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryDateError, setDeliveryDateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayIso = useMemo(() => (open ? getTodayLocalIso() : ''), [open]);
  const saving = isSubmitting || isSaving;

  useEffect(() => {
    if (open && isEdit && editing) {
      setType(editing.type);
      setDeliveryDate(editing.delivery_date ?? '');
      setDescription(editing.description ?? '');
      setDeliveryDateError(null);
    } else if (open && !isEdit) {
      setType(ACTION_PLAN_TYPE_OPTIONS[0].value);
      setDeliveryDate('');
      setDescription('');
      setDeliveryDateError(null);
    }
  }, [open, isEdit, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeliveryDateError(null);
    if (!type.trim()) {
      toast.error('Selecione o tipo.');
      return;
    }
    const desc = description.trim();
    const date = deliveryDate.trim();
    if (!desc || !date) {
      toast.error('Preencha a descrição e a data de entrega.');
      return;
    }
    if (date < todayIso) {
      setDeliveryDateError(DELIVERY_DATE_PAST_MESSAGE);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        type: type.trim(),
        delivery_date: date,
        description: desc,
      });
      toast.success(isEdit ? 'Plano atualizado.' : 'Plano criado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar plano de ação' : 'Novo plano de ação'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_PLAN_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-delivery">Data de entrega *</Label>
            <Input
              id="plan-delivery"
              type="date"
              min={todayIso}
              value={deliveryDate}
              onChange={(e) => {
                setDeliveryDate(e.target.value);
                setDeliveryDateError(null);
              }}
              required
              aria-invalid={!!deliveryDateError}
              aria-describedby={deliveryDateError ? 'plan-delivery-error' : undefined}
            />
            {deliveryDateError && (
              <p id="plan-delivery-error" className="text-sm text-destructive">
                {deliveryDateError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-desc">Descrição *</Label>
            <Textarea
              id="plan-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o objetivo deste plano..."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddActionDialog({
  planId,
  isSaving = false,
  onClose,
  onSubmit,
}: {
  planId: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (description: string) => Promise<void>;
}) {
  const open = planId !== null;
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saving = isSubmitting || isSaving;

  useEffect(() => {
    if (open) setDescription('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Informe a descrição da tarefa.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(description.trim());
      toast.success('Tarefa adicionada.');
    } catch {
      toast.error('Erro ao adicionar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="action-desc">Descrição</Label>
            <Input
              id="action-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que precisa ser feito?"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
