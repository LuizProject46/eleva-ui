import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';
import type { Pdi, PdiCheckin, PdiCheckinInsert, PdiCheckinUpdate, PdiCheckinOverallStatus } from '@/types/pdi';

const CHECKIN_STATUS_LABELS: Record<PdiCheckinOverallStatus, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

interface PdiCheckinsSectionProps {
  pdi: Pdi;
  checkins: PdiCheckin[];
  currentUserId: string;
  canManage: boolean;
  isLoading?: boolean;
  onAddCheckin: (payload: PdiCheckinInsert) => Promise<void>;
  onUpdateCheckin: (id: string, payload: PdiCheckinUpdate) => Promise<void>;
}

export function PdiCheckinsSection({
  pdi,
  checkins,
  currentUserId,
  canManage,
  isLoading = false,
  onAddCheckin,
  onUpdateCheckin,
}: PdiCheckinsSectionProps) {
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [colaboratorName, setColaboratorName] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employeeCommentCheckinId, setEmployeeCommentCheckinId] = useState<string | null>(null);
  const [employeeComment, setEmployeeComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPdiActive = pdi.status === 'active';
  const canAddOrEdit = canManage && isPdiActive;
  const isEmployeeOwnPdi = pdi.employee_id === currentUserId;
  const canEmployeeComment = !canManage && isPdiActive && isEmployeeOwnPdi;
  const latestCheckin = checkins.length > 0 ? checkins[0] : null;
  const canCommentOnLatest =
    canEmployeeComment && latestCheckin && !latestCheckin.employee_comment;

  useEffect(() => {
    if (!pdi.employee_id) return;
    supabase
      .from('profiles')
      .select('id, name, manager_id')
      .eq('id', pdi.employee_id)
      .maybeSingle()
      .then(({ data: employee }) => {
        if (!employee) return;
        setColaboratorName(employee.name ?? '');
        if (!employee.manager_id) {
          setManagerName('');
          return;
        }
        supabase
          .from('profiles')
          .select('id, name')
          .eq('id', employee.manager_id)
          .maybeSingle()
          .then(({ data: manager }) => {
            setManagerName(manager?.name ?? '');
          });
      });
  }, [pdi.employee_id]);

  useEffect(() => {
    const ids = [...new Set(checkins.map((c) => c.author_id))];
    if (ids.length === 0) return;
    supabase
      .from('profiles')
      .select('id, name')
      .in('id', ids)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((r) => {
          map[r.id] = r.name ?? '';
        });
        setAuthorNames(map);
      });
  }, [checkins]);

  const getAuthorLabel = (authorId: string) => {
    const name = authorNames[authorId] ?? (authorId === pdi.employee_id ? colaboratorName : '');
    return authorId === pdi.employee_id
      ? { role: 'Colaborador', name: name || colaboratorName }
      : { role: 'Gestor', name: name || managerName };
  };

  const handleAddSubmit = async (payload: PdiCheckinInsert) => {
    setIsSubmitting(true);
    try {
      await onAddCheckin(payload);
      setAddDialogOpen(false);
    } catch {
      toast.error('Erro ao criar check-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (id: string, payload: PdiCheckinUpdate) => {
    setIsSubmitting(true);
    try {
      await onUpdateCheckin(id, payload);
      setEditingId(null);
    } catch {
      toast.error('Erro ao atualizar check-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmployeeCommentSubmit = async (checkinId: string) => {
    if (!employeeComment.trim()) return;
    setIsSubmitting(true);
    try {
      await onUpdateCheckin(checkinId, { employee_comment: employeeComment.trim() });
      setEmployeeCommentCheckinId(null);
      setEmployeeComment('');
    } catch {
      toast.error('Erro ao enviar comentário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-foreground">Check-ins</h2>
        {canAddOrEdit && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            Adicionar check-in
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Colaborador: <span className="font-medium text-foreground">{colaboratorName || '—'}</span>
        {' · '}
        Gestor: <span className="font-medium text-foreground">{managerName || '—'}</span>
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted/30 p-4 animate-pulse"
            >
              <div className="h-4 w-24 bg-muted rounded mb-2" />
              <div className="h-4 w-32 bg-muted rounded mb-3" />
              <div className="h-12 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : checkins.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum check-in ainda.</p>
      ) : (
        <ul className="space-y-4">
          {checkins.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-muted/30 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {new Date(c.checkin_date).toLocaleDateString('pt-BR')}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                  {CHECKIN_STATUS_LABELS[c.overall_status]}
                </span>
                {(() => {
                  const { role, name } = getAuthorLabel(c.author_id);
                  return (
                    <span className="text-xs text-muted-foreground">
                      {role}: {name || '—'}
                    </span>
                  );
                })()}
                {canAddOrEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      setEditingId(c.id);
                    }}
                  >
                    Editar
                  </Button>
                )}
              </div>
              {c.manager_comment && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    Comentário do gestor
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {c.manager_comment}
                  </p>
                </div>
              )}
              {c.employee_comment && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    Comentário do colaborador
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {c.employee_comment}
                  </p>
                </div>
              )}
              {canEmployeeComment &&
                latestCheckin?.id === c.id &&
                !c.employee_comment && (
                  <div className="pt-2 border-t border-border">
                    {employeeCommentCheckinId === c.id ? (
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleEmployeeCommentSubmit(c.id);
                        }}
                      >
                        <Textarea
                          placeholder="Adicione seu comentário..."
                          value={employeeComment}
                          onChange={(e) => setEmployeeComment(e.target.value)}
                          className="min-h-[60px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isSubmitting || !employeeComment.trim()}
                          >
                            {isSubmitting ? 'Enviando...' : 'Enviar'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEmployeeCommentCheckinId(null);
                              setEmployeeComment('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEmployeeCommentCheckinId(c.id)}
                      >
                        Comentar
                      </Button>
                    )}
                  </div>
                )}
              <EditCheckinDialog
                checkin={c}
                open={editingId === c.id}
                onOpenChange={(open) => !open && setEditingId(null)}
                isSubmitting={isSubmitting}
                onSubmit={(payload) => handleEditSubmit(c.id, payload)}
              />
            </li>
          ))}
        </ul>
      )}

      <AddCheckinDialog
        pdiId={pdi.id}
        currentUserId={currentUserId}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        isSubmitting={isSubmitting}
        onSubmit={handleAddSubmit}
      />
    </div>
  );
}

function formatDateForInput(date: string): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface AddCheckinDialogProps {
  pdiId: string;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (payload: PdiCheckinInsert) => Promise<void>;
}

function AddCheckinDialog({
  pdiId,
  currentUserId,
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: AddCheckinDialogProps) {
  const today = formatDateForInput(new Date().toISOString());
  const [checkinDate, setCheckinDate] = useState(today);
  const [overallStatus, setOverallStatus] = useState<PdiCheckinOverallStatus>('in_progress');
  const [managerComment, setManagerComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      pdi_id: pdiId,
      checkin_date: checkinDate,
      overall_status: overallStatus,
      manager_comment: managerComment.trim() || null,
      author_id: currentUserId,
    });
    setCheckinDate(today);
    setOverallStatus('in_progress');
    setManagerComment('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar check-in</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="checkin-date">Data</Label>
            <Input
              id="checkin-date"
              type="date"
              value={checkinDate}
              onChange={(e) => setCheckinDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Status do progresso</Label>
            <Select
              value={overallStatus}
              onValueChange={(v) => setOverallStatus(v as PdiCheckinOverallStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CHECKIN_STATUS_LABELS) as [PdiCheckinOverallStatus, string][]).map(
                  ([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager-comment">Comentário do gestor (opcional)</Label>
            <Textarea
              id="manager-comment"
              value={managerComment}
              onChange={(e) => setManagerComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditCheckinDialogProps {
  checkin: PdiCheckin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (payload: PdiCheckinUpdate) => Promise<void>;
}

function EditCheckinDialog({
  checkin,
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: EditCheckinDialogProps) {
  const [checkinDate, setCheckinDate] = useState(() =>
    formatDateForInput(checkin.checkin_date)
  );
  const [overallStatus, setOverallStatus] = useState<PdiCheckinOverallStatus>(
    checkin.overall_status
  );
  const [managerComment, setManagerComment] = useState(
    checkin.manager_comment ?? ''
  );

  useEffect(() => {
    if (open) {
      setCheckinDate(formatDateForInput(checkin.checkin_date));
      setOverallStatus(checkin.overall_status);
      setManagerComment(checkin.manager_comment ?? '');
    }
  }, [open, checkin.checkin_date, checkin.overall_status, checkin.manager_comment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      checkin_date: checkinDate,
      overall_status: overallStatus,
      manager_comment: managerComment.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar check-in</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-checkin-date">Data</Label>
            <Input
              id="edit-checkin-date"
              type="date"
              value={checkinDate}
              onChange={(e) => setCheckinDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Status do progresso</Label>
            <Select
              value={overallStatus}
              onValueChange={(v) => setOverallStatus(v as PdiCheckinOverallStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CHECKIN_STATUS_LABELS) as [PdiCheckinOverallStatus, string][]).map(
                  ([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-manager-comment">Comentário do gestor (opcional)</Label>
            <Textarea
              id="edit-manager-comment"
              value={managerComment}
              onChange={(e) => setManagerComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
