import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { PdiEvidence, PdiEvidenceStatus } from '@/types/pdi';
import { getPdiEvidenceSignedUrl, reviewPdiEvidence } from '@/modules/pdi/services/pdiEvidenceService';
import { Eye, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function statusBadge(status: PdiEvidenceStatus): { variant: 'default' | 'secondary' | 'destructive'; label: string } {
  switch (status) {
    case 'approved':
      return { variant: 'default', label: 'Aprovada' };
    case 'rejected':
      return { variant: 'destructive', label: 'Rejeitada' };
    case 'pending':
    default:
      return { variant: 'secondary', label: 'Pendente' };
  }
}

export interface PdiEvidencesManagerTabProps {
  pdiId: string;
  managerId: string;
  evidences: PdiEvidence[];
}

export function PdiEvidencesManagerTab({ pdiId, managerId, evidences }: PdiEvidencesManagerTabProps) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<PdiEvidenceStatus | 'all'>('pending');
  const [rejectEvidenceId, setRejectEvidenceId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState<string>('');
  const [isApprovingEvidenceId, setIsApprovingEvidenceId] = useState<string | null>(null);
  const [isRejectingEvidenceId, setIsRejectingEvidenceId] = useState<string | null>(null);
  const [isViewingEvidenceId, setIsViewingEvidenceId] = useState<string | null>(null);

  const rejectFeedbackTrimmed = rejectFeedback.trim();
  const isRejectInProgress = rejectEvidenceId !== null && isRejectingEvidenceId === rejectEvidenceId;
  const isRejectConfirmDisabled = rejectFeedbackTrimmed.length === 0 || isRejectingEvidenceId !== null;

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return evidences;
    return evidences.filter((e) => e.status === filterStatus);
  }, [evidences, filterStatus]);

  const handleInvalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['pdiEvidences', pdiId] });
  };

  const handleApprove = async (evidenceId: string) => {
    if (isApprovingEvidenceId === evidenceId || isRejectingEvidenceId === evidenceId) return;
    setIsApprovingEvidenceId(evidenceId);
    try {
      await reviewPdiEvidence({
        evidenceId,
        reviewedBy: managerId,
        status: 'approved',
        feedback: null,
      });
      toast.success('Evidência aprovada.');

      try {
        const { data: { session } } = await supabase.auth.refreshSession();
        console.log('session', session);
        if (session?.access_token) {
          const { error: notifyErr } = await supabase.functions.invoke('pdi-evidence-review-notify', {
            body: { evidence_id: evidenceId, review_status: 'approved', feedback: null },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (notifyErr) toast.error('Não foi possível notificar o colaborador.');
            if (!notifyErr) toast.success('Notificação enviada ao colaborador.');
        }
      } catch {
        toast.error('Não foi possível notificar o colaborador.');
      }
      await handleInvalidate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar.';
      toast.error(msg);
    } finally {
      setIsApprovingEvidenceId(null);
    }
  };

  const openRejectDialog = (evidenceId: string) => {
    if (isApprovingEvidenceId === evidenceId || isRejectingEvidenceId === evidenceId) return;
    setRejectEvidenceId(evidenceId);
    setRejectFeedback('');
  };

  const handleReject = async () => {
    if (!rejectEvidenceId) return;
    const evidenceId = rejectEvidenceId;
    const trimmedFeedback = rejectFeedback.trim();
    if (!trimmedFeedback) {
      toast.error('Informe um feedback para rejeição.');
      return;
    }

    if (isApprovingEvidenceId === evidenceId || isRejectingEvidenceId === evidenceId) return;
    setIsRejectingEvidenceId(evidenceId);
    try {
      await reviewPdiEvidence({
        evidenceId,
        reviewedBy: managerId,
        status: 'rejected',
        feedback: trimmedFeedback,
      });
      toast.success('Evidência rejeitada.');

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const { error: notifyErr } = await supabase.functions.invoke('pdi-evidence-review-notify', {
            body: { evidence_id: evidenceId, review_status: 'rejected', feedback: trimmedFeedback },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (notifyErr) toast.error('Não foi possível notificar o colaborador.');
            if (!notifyErr) toast.success('Notificação enviada ao colaborador.');
        }
      } catch {
        toast.error('Não foi possível notificar o colaborador.');
      }
      await handleInvalidate();
      setRejectEvidenceId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao rejeitar.';
      toast.error(msg);
    } finally {
      setIsRejectingEvidenceId(null);
    }
  };

  const handleView = async (evidence: PdiEvidence) => {
    setIsViewingEvidenceId(evidence.id);
    try {
      const url = await getPdiEvidenceSignedUrl({ storagePath: evidence.storage_path, expiresInSeconds: 3600 });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível abrir o arquivo.';
      toast.error(msg);
    } finally {
      setIsViewingEvidenceId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Evidências</h3>
          <p className="text-sm text-muted-foreground">
            Revise as evidências enviadas pelo colaborador e atualize o status.
          </p>
        </div>

        <div className="w-full sm:w-[260px]">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as PdiEvidenceStatus | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="approved">Aprovada</SelectItem>
              <SelectItem value="rejected">Rejeitada</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-6 rounded-xl border border-border bg-muted/20">
          <p className="text-sm text-muted-foreground">Nenhuma evidência encontrada para o filtro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((evidence) => {
            const badge = statusBadge(evidence.status);
            const isApproving = isApprovingEvidenceId === evidence.id;
            const isRejecting = isRejectingEvidenceId === evidence.id;
            const isReviewingThisEvidence = isApproving || isRejecting;
            const isViewing = isViewingEvidenceId === evidence.id;
            const canReview = evidence.status === 'pending';
            return (
              <div
                key={evidence.id}
                className="flex items-start justify-between gap-4 rounded-md border border-border bg-background p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={badge.variant} className="shrink-0">
                      {badge.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(evidence.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-foreground truncate mt-2">{evidence.file_name}</p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-2"
                      onClick={() => void handleView(evidence)}
                      disabled={isViewing}
                    >
                      {isViewing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                      Ver
                    </Button>
                  </div>

                  {canReview ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        disabled={isReviewingThisEvidence}
                        onClick={() => void handleApprove(evidence.id)}
                      >
                        {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aprovar'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isReviewingThisEvidence}
                        onClick={() => openRejectDialog(evidence.id)}
                      >
                        {isRejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rejeitar'}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Revisão finalizada</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={rejectEvidenceId !== null}
        onOpenChange={(open) => {
          if (!open && isRejectingEvidenceId === null) setRejectEvidenceId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar evidência</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Campo obrigatório: adicione um feedback para o colaborador.
            </p>
            <Textarea
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              placeholder="Ex.: revise a evidência com mais detalhes..."
              required={true}
              rows={4}
              disabled={isRejectingEvidenceId !== null}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectEvidenceId(null)}
              disabled={isRejectingEvidenceId !== null}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={isRejectConfirmDisabled || isRejectInProgress}
              className="gap-2"
            >
              {isRejectInProgress ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

