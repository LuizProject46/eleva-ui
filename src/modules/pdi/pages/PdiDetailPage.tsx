import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { usePdiPermissions } from '@/modules/pdi/usePdiPermissions';
import { supabase } from '@/lib/supabase';
import type { Pdi, PdiCloseResult, PdiEvidence } from '@/types/pdi';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  CalendarClock,
  CalendarCheck,
  Download,
  Loader2,
  MessageSquareText,
} from 'lucide-react';
import { toast } from 'sonner';
import { PDI_CLOSE_RESULT_LABELS, PDI_STATUS_LABELS } from '@/lib/pdiLifecycle';
import { PDI_TYPE_LABELS } from '@/constants/pdiTypes';

import { getPdi, updatePdi } from '@/modules/pdi/services/pdiService';
import { usePdiActionPlans } from '@/modules/pdi/hooks/usePdiActionPlans';
import { usePdiPlanActions } from '@/modules/pdi/hooks/usePdiPlanActions';
import { derivePdiStatus } from '@/modules/pdi/utils/derivePdiStatus';
import { usePdiPdfDownload } from '@/modules/pdi/hooks/usePdiPdfDownload';
import { usePdiEvidences } from '@/modules/pdi/hooks/usePdiEvidences';

import { createPdiEvidenceRecord, deletePdiEvidenceRecord, uploadPdiEvidenceFile } from '@/modules/pdi/services/pdiEvidenceService';

import { PdiContextSection } from '@/components/pdi/PdiContextSection';
import { PdiActionPlansSection } from '@/modules/pdi/components/PdiActionPlansSection';
import { PdiCloseSection } from '@/components/pdi/PdiCloseSection';
import { canTransitionTo } from '@/lib/pdiLifecycle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PdiEvidencesManagerTab } from '@/modules/pdi/components/PdiEvidencesManagerTab';

function closeResultBadgeClass(result: PdiCloseResult): string {
  switch (result) {
    case 'completed':
      return 'border-primary/25 bg-primary/10 text-primary';
    case 'partial':
      return 'border-border bg-muted text-foreground';
    case 'not_completed':
      return 'border-destructive/25 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-muted text-foreground';
  }
}

export default function PdiDetailPage() {
  const { pdiId } = useParams<{ pdiId: string }>();
  const { user } = useAuth();
  const { canEditPdiContent, canArchiveClosedPdi } = usePdiPermissions();
  const canManage = canEditPdiContent;

  const queryClient = useQueryClient();
  const { downloadPdiPdf, isDownloadingPdf } = usePdiPdfDownload();
  const [employeeName, setEmployeeName] = useState<string>('');
  const [createdByNames, setCreatedByNames] = useState<Record<string, string>>({});

  const pdiQuery = useQuery({
    enabled: !!pdiId,
    queryKey: ['pdi', pdiId],
    queryFn: async () => {
      if (!pdiId) return null;
      return getPdi(pdiId);
    },
  });

  const pdi = pdiQuery.data as Pdi | null;

  const actionPlans = usePdiActionPlans(pdiId ?? null);
  const planActions = usePdiPlanActions(pdiId ?? null);
  const pdiEvidencesQuery = usePdiEvidences(pdiId ?? null);

  const progress = useMemo(() => {
    const list = planActions.data ?? [];
    const total = list.length;
    const completed = list.filter((a) => a.completed).length;
    const pct = total > 0 ? Math.round((100 * completed) / total) : 0;
    return { total, completed, pct };
  }, [planActions.data]);

  const progressStatus = useMemo(() => {
    if (!pdi) return null;
    return derivePdiStatus(
      pdi,
      planActions.data ?? [],
      actionPlans.data ?? []
    );
  }, [pdi, planActions.data, actionPlans.data]);

  const canEdit =
    canManage &&
    !!pdi &&
    (pdi.status === 'draft' || pdi.status === 'active');

  const canActivate = !!pdi && canTransitionTo(pdi, 'active');

  useEffect(() => {
    if (!pdi?.employee_id) return;
    supabase
      .from('profiles')
      .select('name')
      .eq('id', pdi.employee_id)
      .maybeSingle()
      .then(({ data }) => {
        setEmployeeName((data as { name?: string } | null)?.name ?? '');
      });
  }, [pdi?.employee_id]);

  useEffect(() => {
    const plans = actionPlans.data ?? [];
    const creatorIds = [...new Set(plans.map((p) => p.created_by).filter(Boolean))] as string[];
    if (creatorIds.length === 0) {
      setCreatedByNames({});
      return;
    }
    supabase
      .from('profiles')
      .select('id, name')
      .in('id', creatorIds)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((row: { id: string; name?: string }) => {
          map[row.id] = row.name ?? '';
        });
        setCreatedByNames(map);
      });
  }, [actionPlans.data]);

  useEffect(() => {
    if (pdiQuery.isError) toast.error('Erro ao carregar PDI');
  }, [pdiQuery.isError]);

  const updatePdiMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof updatePdi>[1];
    }) => updatePdi(id, updates),
    onSuccess: async () => {
      if (!pdiId) return;
      await queryClient.invalidateQueries({ queryKey: ['pdi', pdiId] });
    },
  });

  const handleStatusChange = useCallback(
    async (newStatus: Pdi['status']) => {
      if (!pdi) return;
      try {
        await updatePdiMutation.mutateAsync({
          id: pdi.id,
          updates: { status: newStatus },
        });
        if (newStatus === 'active') toast.success('PDI ativado.');
        else toast.success('Status atualizado.');
      } catch (err) {
        toast.error(
          err && typeof err === 'object' && 'code' in err && err.code === '42501'
            ? 'Sem permissão para alterar este PDI.'
            : 'Erro ao atualizar status.'
        );
      }
    },
    [pdi, updatePdiMutation]
  );

  const handleClose = useCallback(
    async (result: 'completed' | 'partial' | 'not_completed', closeComment: string | null) => {
      if (!pdi) return;
      try {
        await updatePdiMutation.mutateAsync({
          id: pdi.id,
          updates: {
            status: 'closed',
            closed_at: new Date().toISOString(),
            result,
            close_comment: closeComment ?? null,
          },
        });
        toast.success('PDI encerrado.');
      } catch (err) {
        toast.error(
          err && typeof err === 'object' && 'code' in err && err.code === '42501'
            ? 'Sem permissão para alterar este PDI.'
            : 'Erro ao encerrar PDI.'
        );
      }
    },
    [pdi, updatePdiMutation]
  );

  const handleArchive = useCallback(async () => {
    if (!pdi) return;
    try {
      await updatePdiMutation.mutateAsync({
        id: pdi.id,
        updates: { status: 'archived' },
      });
      toast.success('PDI arquivado.');
    } catch (err) {
      toast.error(
        err && typeof err === 'object' && 'code' in err && err.code === '42501'
          ? 'Sem permissão para alterar este PDI.'
          : 'Erro ao arquivar PDI.'
      );
    }
  }, [pdi, updatePdiMutation]);

  const evidences = pdiEvidencesQuery.data ?? [];

  const evidencesByPlanActionId = useMemo(() => {
    const map: Record<string, PdiEvidence[]> = {};
    for (const ev of evidences) {
      if (!ev.pdi_plan_action_id) continue;
      if (!map[ev.pdi_plan_action_id]) map[ev.pdi_plan_action_id] = [];
      map[ev.pdi_plan_action_id].push(ev);
    }
    return map;
  }, [evidences]);

  const evidencesByActionPlanId = useMemo(() => {
    const map: Record<string, PdiEvidence[]> = {};
    for (const ev of evidences) {
      if (!ev.pdi_action_plan_id) continue;
      if (!map[ev.pdi_action_plan_id]) map[ev.pdi_action_plan_id] = [];
      map[ev.pdi_action_plan_id].push(ev);
    }
    return map;
  }, [evidences]);

  const canUploadEvidence = !!pdi && user?.role === 'employee' && pdi.status === 'active';

  const handleUploadPlanEvidence = useCallback(
    async ({ pdiActionPlanId, file }: { pdiActionPlanId: string; file: File }) => {
      if (!pdi || !user?.id || !user.tenantId) throw new Error('Sem permissão para enviar evidências.');

      let record: PdiEvidence | null = null;
      try {
        record = await createPdiEvidenceRecord({
          tenantId: user.tenantId,
          pdiId: pdi.id,
          submittedBy: user.id,
          pdiActionPlanId,
          file,
        });
        await uploadPdiEvidenceFile({ storagePath: record.storage_path, file });
      } catch (err) {
        if (record) {
          await deletePdiEvidenceRecord({ evidenceId: record.id, storagePath: record.storage_path });
        }
        throw err instanceof Error ? err : new Error('Falha ao enviar evidência.');
      } finally {
        await pdiEvidencesQuery.refetch();
      }
    },
    [pdi, user?.id, user.tenantId, pdiEvidencesQuery]
  );

  const handleUploadTaskEvidence = useCallback(
    async ({ pdiPlanActionId, file }: { pdiPlanActionId: string; file: File }) => {
      if (!pdi || !user?.id || !user.tenantId) throw new Error('Sem permissão para enviar evidências.');

      let record: PdiEvidence | null = null;
      try {
        record = await createPdiEvidenceRecord({
          tenantId: user.tenantId,
          pdiId: pdi.id,
          submittedBy: user.id,
          pdiPlanActionId,
          file,
        });
        await uploadPdiEvidenceFile({ storagePath: record.storage_path, file });
      } catch (err) {
        if (record) {
          await deletePdiEvidenceRecord({ evidenceId: record.id, storagePath: record.storage_path });
        }
        throw err instanceof Error ? err : new Error('Falha ao enviar evidência.');
      } finally {
        await pdiEvidencesQuery.refetch();
      }
    },
    [pdi, user?.id, user.tenantId, pdiEvidencesQuery]
  );

  if (!pdiId) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">PDI não encontrado.</div>
      </MainLayout>
    );
  }

  const isLoading =
    pdiQuery.isLoading || actionPlans.isLoading || planActions.isLoading || pdiEvidencesQuery.isLoading;

  if (isLoading || !pdi) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </MainLayout>
    );
  }

  const statusBadgeVariant =
    pdi.status === 'active'
      ? 'default'
      : pdi.status === 'closed'
        ? 'secondary'
        : pdi.status === 'archived'
          ? 'outline'
          : 'secondary';

  const actionPlansSection = (
    <PdiActionPlansSection
      pdi={pdi}
      actionPlans={actionPlans.data ?? []}
      planActions={planActions.data ?? []}
      createdByNames={createdByNames}
      canEdit={canEdit}
      canUploadEvidence={canUploadEvidence}
      evidencesByPlanActionId={evidencesByPlanActionId}
      evidencesByActionPlanId={evidencesByActionPlanId}
      onUploadPlanEvidence={handleUploadPlanEvidence}
      onUploadTaskEvidence={handleUploadTaskEvidence}
      currentUserId={user?.id ?? ''}
      isSavingPlan={actionPlans.createPlan.isPending || actionPlans.updatePlan.isPending}
      isSavingAction={planActions.createAction.isPending}
      isUpdatingAction={planActions.updateAction.isPending}
      updatingActionId={
        planActions.updateAction.isPending ? planActions.updateAction.variables?.actionId ?? null : null
      }
      isDeletingPlan={actionPlans.deletePlan.isPending}
      isDeletingAction={planActions.deleteAction.isPending}
      onCreatePlan={async (payload) => {
        await actionPlans.createPlan.mutateAsync(payload);
      }}
      onUpdatePlan={async (planId, updates) => {
        await actionPlans.updatePlan.mutateAsync({ planId, updates });
      }}
      onDeletePlan={async (planId) => {
        await actionPlans.deletePlan.mutateAsync(planId);
      }}
      onCreateAction={async (payload) => {
        await planActions.createAction.mutateAsync(payload);
      }}
      onUpdateAction={async (actionId, updates) => {
        await planActions.updateAction.mutateAsync({ actionId, updates });
      }}
      onDeleteAction={async (actionId) => {
        await planActions.deleteAction.mutateAsync(actionId);
      }}
    />
  );

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Button variant="ghost" size="icon" asChild aria-label="Voltar para lista de PDIs" className="shrink-0 mt-0.5">
                <Link to="/pdis">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground truncate">
                  {pdi.title || 'Plano de Desenvolvimento Individual'}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <Link
                    to={`/employees/${pdi.employee_id}`}
                    className="text-primary hover:underline font-medium text-foreground"
                  >
                    {employeeName || pdi.employee_id}
                  </Link>
                  <span>{PDI_TYPE_LABELS[pdi.type] ?? pdi.type}</span>
                  <span>
                    Criado em {new Date(pdi.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <Badge variant={statusBadgeVariant} className="shrink-0">
                    {PDI_STATUS_LABELS[pdi.status] ?? pdi.status}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto shrink-0 gap-2 border-border"
              disabled={isDownloadingPdf}
              onClick={() => void downloadPdiPdf(pdi.id)}
              aria-label="Baixar PDF do PDI com resumo e detalhes"
            >
              {isDownloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
              Baixar PDF
            </Button>
          </div>
          <p className="text-sm text-muted-foreground pl-0 sm:pl-11 max-w-2xl">
            O PDF inclui identificação, resumo de andamento e resultados, contexto (quando houver) e
            todos os planos de ação com tarefas.
          </p>
        </header>

        {pdi.status !== 'closed' && pdi.status !== 'archived' ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Progresso</h2>
                  {progressStatus ? (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        progressStatus === 'completed'
                          ? 'bg-primary/10 text-primary'
                          : progressStatus === 'overdue'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {progressStatus === 'completed'
                        ? 'Concluído'
                        : progressStatus === 'overdue'
                          ? 'Em atraso'
                          : 'Em andamento'}
                    </span>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {progress.total > 0 ? (
                  <>
                    <div className="flex items-center gap-4">
                      <Progress value={progress.pct} className="flex-1 h-2" />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {progress.completed}/{progress.total} tarefas concluídas
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma ação ainda.</p>
                )}
              </CardContent>
            </Card>

            <PdiContextSection employeeId={pdi.employee_id} />
          </>
        ) : null}

        {user?.role === 'manager' && user?.id ? (
          <Tabs defaultValue="plans" className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="plans">Plano de ação</TabsTrigger>
              <TabsTrigger value="evidences">Evidências</TabsTrigger>
            </TabsList>
            <TabsContent value="plans">{actionPlansSection}</TabsContent>
            <TabsContent value="evidences">
              <PdiEvidencesManagerTab pdiId={pdi.id} managerId={user.id} evidences={evidences} />
            </TabsContent>
          </Tabs>
        ) : (
          actionPlansSection
        )}

        {pdi.status === 'draft' && canManage && canActivate && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Ative o PDI para que o colaborador e o gestor acompanhem o plano.
              </p>
              <Button onClick={() => void handleStatusChange('active')}>
                Ativar PDI
              </Button>
            </CardContent>
          </Card>
        )}

        {pdi.status === 'active' && canManage && (
          <PdiCloseSection onClose={handleClose} />
        )}

        {pdi.status === 'closed' && canArchiveClosedPdi && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-foreground">Arquivar PDI</h2>
              <p className="text-sm text-muted-foreground">
                PDIs concluídos podem ser arquivados para manter a lista organizada.
              </p>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleArchive}>
                Arquivar PDI
              </Button>
            </CardContent>
          </Card>
        )}

        {(pdi.status === 'closed' || pdi.status === 'archived') && (
          <Card className="overflow-hidden border-border shadow-sm">
            <CardHeader className="space-y-0 border-b border-border bg-muted/40 px-4 py-4 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <CalendarCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">
                      Encerramento
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Registro definido ao finalizar o PDI
                    </p>
                  </div>
                </div>
                {pdi.status === 'archived' ? (
                  <Badge variant="outline" className="w-fit shrink-0 text-xs font-normal">
                    {PDI_STATUS_LABELS.archived}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-4 md:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {pdi.result ? (
                  <div className="flex flex-col justify-center rounded-xl border border-border bg-muted/20 p-4 md:p-5">
                    <p className="text-xs font-medium text-muted-foreground mb-3">
                      Resultado do plano
                    </p>
                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${closeResultBadgeClass(pdi.result)}`}
                    >
                      {PDI_CLOSE_RESULT_LABELS[pdi.result]}
                    </span>
                  </div>
                ) : null}
                {pdi.closed_at ? (
                  <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/10 p-4 md:p-5">
                    <div className="absolute right-3 top-3 opacity-[0.07] pointer-events-none hidden sm:block">
                      <CalendarClock className="h-16 w-16 text-foreground" strokeWidth={1} />
                    </div>
                    <div className="relative flex gap-4">
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border"
                        aria-hidden
                      >
                        <CalendarClock className="h-6 w-6 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Data e hora do encerramento
                        </p>
                        <p className="text-xl font-semibold text-foreground tracking-tight tabular-nums sm:text-2xl">
                          {new Date(pdi.closed_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="inline-block h-px w-6 bg-border shrink-0" aria-hidden />
                          {new Date(pdi.closed_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          <span className="text-xs">(horário local)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-border bg-muted/15 p-4 md:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground">
                    Comentários do gestor
                  </p>
                </div>
                {pdi.close_comment?.trim() ? (
                  <blockquote className="text-sm leading-relaxed text-foreground whitespace-pre-wrap border-l-2 border-primary/40 pl-4 py-0.5">
                    {pdi.close_comment.trim()}
                  </blockquote>
                ) : (
                  <p className="text-sm text-muted-foreground italic pl-0.5">
                    Nenhum comentário foi informado no encerramento.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
