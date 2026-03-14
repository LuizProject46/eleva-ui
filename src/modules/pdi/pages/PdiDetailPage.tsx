import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Pdi } from '@/types/pdi';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PDI_STATUS_LABELS } from '@/lib/pdiLifecycle';
import { PDI_TYPE_LABELS } from '@/constants/pdiTypes';

import { getPdi, updatePdi } from '@/modules/pdi/services/pdiService';
import { usePdiActionPlans } from '@/modules/pdi/hooks/usePdiActionPlans';
import { usePdiPlanActions } from '@/modules/pdi/hooks/usePdiPlanActions';
import { derivePdiStatus } from '@/modules/pdi/utils/derivePdiStatus';

import { PdiContextSection } from '@/components/pdi/PdiContextSection';
import { PdiActionPlansSection } from '@/modules/pdi/components/PdiActionPlansSection';
import { PdiCloseSection } from '@/components/pdi/PdiCloseSection';
import { canTransitionTo } from '@/lib/pdiLifecycle';

export default function PdiDetailPage() {
  const { pdiId } = useParams<{ pdiId: string }>();
  const { user, canManagePdi, isHR } = useAuth();
  const canManage = canManagePdi();

  const queryClient = useQueryClient();
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
      } catch {
        toast.error('Erro ao atualizar status.');
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
      } catch {
        toast.error('Erro ao encerrar PDI.');
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
    } catch {
      toast.error('Erro ao arquivar PDI.');
    }
  }, [pdi, updatePdiMutation]);

  if (!pdiId) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">PDI não encontrado.</div>
      </MainLayout>
    );
  }

  const isLoading =
    pdiQuery.isLoading || actionPlans.isLoading || planActions.isLoading;

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

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild aria-label="Voltar para lista de PDIs">
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
        </header>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Progresso</h2>
              {progressStatus && (
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
              )}
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

        <PdiActionPlansSection
          pdi={pdi}
          actionPlans={actionPlans.data ?? []}
          planActions={planActions.data ?? []}
          createdByNames={createdByNames}
          canEdit={canEdit}
          currentUserId={user?.id ?? ''}
          isSavingPlan={
            actionPlans.createPlan.isPending || actionPlans.updatePlan.isPending
          }
          isSavingAction={planActions.createAction.isPending}
          isUpdatingAction={planActions.updateAction.isPending}
          updatingActionId={
            planActions.updateAction.isPending
              ? planActions.updateAction.variables?.actionId ?? null
              : null
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

        {pdi.status === 'closed' && isHR() && (
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
      </div>
    </MainLayout>
  );
}
