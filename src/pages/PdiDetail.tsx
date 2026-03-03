import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getPdi,
  listObjectives,
  listActionsByPdi,
  listCheckins,
  getPdiProgress,
  updatePdi,
  createCheckin,
  updateCheckin,
} from '@/services/pdiService';
import type { Pdi, PdiObjective, PdiAction, PdiCheckin } from '@/types/pdi';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { PdiContextSection } from '@/components/pdi/PdiContextSection';
import { PdiDiagnosticSection } from '@/components/pdi/PdiDiagnosticSection';
import { PdiObjectivesSection } from '@/components/pdi/PdiObjectivesSection';
import { PdiCheckinsSection } from '@/components/pdi/PdiCheckinsSection';
import { PdiApprovalSection } from '@/components/pdi/PdiApprovalSection';
import { PdiCloseSection } from '@/components/pdi/PdiCloseSection';
import { PDI_STATUS_LABELS } from '@/lib/pdiLifecycle';

export default function PdiDetail() {
  const { pdiId } = useParams<{ pdiId: string }>();
  const { user, canManagePdi, isHR } = useAuth();
  const canManage = canManagePdi();

  const [pdi, setPdi] = useState<Pdi | null>(null);
  const [employeeName, setEmployeeName] = useState<string>('');
  const [objectives, setObjectives] = useState<PdiObjective[]>([]);
  const [actions, setActions] = useState<PdiAction[]>([]);
  const [checkins, setCheckins] = useState<PdiCheckin[]>([]);
  const [progress, setProgress] = useState<{ completed: number; total: number; pct: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPdi = useCallback(async () => {
    if (!pdiId) return;
    const data = await getPdi(pdiId);
    setPdi(data);
    if (data?.employee_id) {
      const { data: prof } = await supabase.from('profiles').select('name').eq('id', data.employee_id).maybeSingle();
      setEmployeeName((prof as { name?: string } | null)?.name ?? '');
    }
  }, [pdiId]);

  const fetchObjectives = useCallback(async () => {
    if (!pdiId) return;
    const list = await listObjectives(pdiId);
    setObjectives(list);
  }, [pdiId]);

  const fetchActions = useCallback(async () => {
    if (!pdiId) return;
    const list = await listActionsByPdi(pdiId);
    setActions(list);
  }, [pdiId]);

  const fetchCheckins = useCallback(async () => {
    if (!pdiId) return;
    const list = await listCheckins(pdiId);
    setCheckins(list);
  }, [pdiId]);

  const fetchProgress = useCallback(async () => {
    if (!pdiId) return;
    const prog = await getPdiProgress(pdiId);
    setProgress(prog ? { completed: prog.completed_actions, total: prog.total_actions, pct: prog.progress_pct } : null);
  }, [pdiId]);

  const loadAll = useCallback(async () => {
    if (!pdiId) return;
    setIsLoading(true);
    try {
      await fetchPdi();
      await Promise.all([fetchObjectives(), fetchActions(), fetchCheckins(), fetchProgress()]);
    } catch {
      toast.error('Erro ao carregar PDI');
    } finally {
      setIsLoading(false);
    }
  }, [pdiId, fetchPdi, fetchObjectives, fetchActions, fetchCheckins, fetchProgress]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshObjectives = useCallback(() => {
    fetchObjectives();
    fetchActions();
    fetchProgress();
  }, [fetchObjectives, fetchActions, fetchProgress]);

  const refreshCheckins = useCallback(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  const handleStatusChange = useCallback(async (newStatus: Pdi['status']) => {
    if (!pdi) return;
    try {
      await updatePdi(pdi.id, { status: newStatus });
      setPdi((prev) => (prev ? { ...prev, status: newStatus } : null));
      if (newStatus === 'active') toast.success('PDI aprovado.');
      else if (newStatus === 'draft') toast.success('PDI devolvido para ajustes.');
      else toast.success('PDI enviado para aprovação.');
    } catch {
      toast.error('Erro ao atualizar status.');
    }
  }, [pdi]);

  const handleClose = useCallback(
    async (result: 'completed' | 'partial' | 'not_completed', closeComment: string | null) => {
      if (!pdi) return;
      try {
        await updatePdi(pdi.id, {
          status: 'closed',
          closed_at: new Date().toISOString(),
          result,
          close_comment: closeComment ?? null,
        });
        setPdi((prev) =>
          prev
            ? {
                ...prev,
                status: 'closed',
                closed_at: new Date().toISOString(),
                result,
                close_comment: closeComment ?? null,
              }
            : null
        );
        toast.success('PDI encerrado.');
      } catch {
        toast.error('Erro ao encerrar PDI.');
      }
    },
    [pdi]
  );

  const handleArchive = useCallback(async () => {
    if (!pdi) return;
    try {
      await updatePdi(pdi.id, { status: 'archived' });
      setPdi((prev) => (prev ? { ...prev, status: 'archived' } : null));
      toast.success('PDI arquivado.');
    } catch {
      toast.error('Erro ao arquivar PDI.');
    }
  }, [pdi]);

  if (!pdiId) {
    return (
      <MainLayout>
        <div className="p-4 md:p-8">PDI não encontrado.</div>
      </MainLayout>
    );
  }

  if (isLoading || !pdi) {
    return (
      <MainLayout>
        <div className="p-4 md:p-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/pdis">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              PDI
            </h1>
            <p className="text-muted-foreground">
              <Link to={`/employees/${pdi.employee_id}`} className="text-primary hover:underline">
                {employeeName || pdi.employee_id}
              </Link>
              {' · '}
              {new Date(pdi.start_date).toLocaleDateString('pt-BR')} – {new Date(pdi.end_date).toLocaleDateString('pt-BR')}
              {' · '}
              {PDI_STATUS_LABELS[pdi.status] ?? pdi.status}
            </p>
          </div>
        </div>

        {((objectives.length > 0) || (progress && progress.total > 0)) && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <p className="text-sm font-medium text-foreground">Progresso</p>
            {objectives.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Objetivos: {objectives.filter((o) => o.status === 'completed').length} de {objectives.length} concluídos
              </p>
            )}
            {progress && progress.total > 0 && (
              <div className="flex items-center gap-4">
                <Progress value={progress.pct} className="flex-1 h-2" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {progress.completed}/{progress.total} planos de ação concluídos
                </span>
              </div>
            )}
          </div>
        )}

        <PdiContextSection employeeId={pdi.employee_id} />

        {(pdi.evaluation_id || pdi.behavioral_assessment_id) && canManage && (
          <PdiDiagnosticSection
            pdi={pdi}
            onObjectivesCreated={refreshObjectives}
          />
        )}

        <PdiObjectivesSection
          pdi={pdi}
          objectives={objectives}
          actions={actions}
          onUpdate={refreshObjectives}
          canManage={canManage}
        />

        <PdiCheckinsSection
          pdi={pdi}
          checkins={checkins}
          currentUserId={user?.id ?? ''}
          canManage={canManage}
          isLoading={isLoading}
          onAddCheckin={async (payload) => {
            await createCheckin(payload);
            refreshCheckins();
          }}
          onUpdateCheckin={async (id, updates) => {
            await updateCheckin(id, updates);
            refreshCheckins();
          }}
        />

        {pdi.status === 'draft' && canManage && (
          <div className="rounded-lg border border-border bg-card p-4 md:p-6">
            <p className="text-sm text-muted-foreground mb-2">Envie o PDI para aprovação pelo RH.</p>
            <Button onClick={() => handleStatusChange('in_approval')}>Enviar para aprovação</Button>
          </div>
        )}

        {pdi.status === 'in_approval' && isHR() && (
          <PdiApprovalSection onApprove={() => handleStatusChange('active')} onReject={() => handleStatusChange('draft')} />
        )}

        {pdi.status === 'active' && canManage && (
          <PdiCloseSection onClose={handleClose} />
        )}

        {pdi.status === 'closed' && isHR() && (
          <div className="rounded-lg border border-border bg-card p-4 md:p-6">
            <h2 className="font-semibold text-foreground mb-2">Arquivar PDI</h2>
            <p className="text-sm text-muted-foreground mb-2">
              PDIs concluídos podem ser arquivados para manter a lista organizada.
            </p>
            <Button variant="outline" onClick={handleArchive}>
              Arquivar PDI
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
