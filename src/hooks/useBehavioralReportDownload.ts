import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { buildBehavioralReportPdf } from '@/lib/behavioralReportPdf';
import type { BehavioralReportPayload } from '@/lib/behavioralReportPdf';
import type { DiscKey } from '@/constants/discProfiles';
import { toast } from 'sonner';

interface AssessmentRow {
  status: string;
  answers: Record<string, string> | null;
  result: string | null;
  completed_at: string | null;
}

interface ProfileRow {
  name: string | null;
  department: string | null;
  position: string | null;
  manager_id: string | null;
}

export function useBehavioralReportDownload() {
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingUserId, setDownloadingUserId] = useState<string | null>(null);

  const fetchReportData = useCallback(
    async (
      userId: string,
      managerName?: string | null
    ): Promise<BehavioralReportPayload | null> => {
      const { data: assessment, error: assessmentError } = await supabase
        .from('behavioral_assessments')
        .select('status, answers, result, completed_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (assessmentError || !assessment) {
        return null;
      }

      const row = assessment as AssessmentRow;
      if (row.status !== 'completed' || !row.answers || !row.completed_at) {
        return null;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name, department, position, manager_id')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        return null;
      }

      const profileRow = profile as ProfileRow;
      let teamName: string | null = managerName ?? null;
      if (!teamName && profileRow.manager_id) {
        const { data: manager } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', profileRow.manager_id)
          .maybeSingle();
        teamName = manager?.name ?? null;
      }

      const answers = row.answers as Record<string, DiscKey>;
      const totalQuestions = Object.keys(answers).length || 1;
      const primaryResult = (row.result ?? 'D') as DiscKey;

      const payload: BehavioralReportPayload = {
        employeeName: profileRow.name ?? '—',
        employeeRole: profileRow.position ?? null,
        department: profileRow.department ?? null,
        team: teamName,
        primaryResult,
        answers,
        totalQuestions,
        completedAt: row.completed_at,
        evaluator: 'Autoavaliação',
      };
      return payload;
    },
    []
  );

  const downloadReport = useCallback(
    async (userId?: string, employeeName?: string, managerName?: string | null) => {
      const targetUserId = userId ?? user?.id;
      if (!targetUserId || !user?.id) {
        setDownloadError('Usuário não identificado');
        return;
      }

      setDownloadError(null);
      setDownloadingUserId(targetUserId);
      setIsDownloading(true);

      try {
        const payload = await fetchReportData(targetUserId, managerName);
        if (!payload) {
          toast.error('Não foi possível gerar o relatório. Verifique se a avaliação está concluída.');
          setDownloadError('Dados não encontrados ou avaliação não concluída');
          return;
        }

        const blob = buildBehavioralReportPdf(payload);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeName = (payload.employeeName || 'Colaborador').replace(/[^a-zA-Z0-9\u00C0-\u00FF\s]/g, '');
        const dateStr = payload.completedAt
          ? new Date(payload.completedAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        link.download = `Relatorio-DISC-${safeName}-${dateStr}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(
          employeeName
            ? `Relatório de ${employeeName} baixado.`
            : 'Relatório baixado com sucesso.'
        );
      } catch {
        toast.error('Não foi possível gerar o relatório.');
        setDownloadError('Erro ao gerar PDF');
      } finally {
        setIsDownloading(false);
        setDownloadingUserId(null);
      }
    },
    [user?.id, fetchReportData]
  );

  return {
    downloadReport,
    isDownloading,
    downloadError,
    downloadingUserId,
  };
}
