import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// TODO: Migrar para API REST Laravel - escopo separado
// import api from '@/lib/api';

export interface CompetencyCycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export interface CompetencyItem {
  id: string;
  cycle_id: string;
  order: number;
  name: string;
  description: string | null;
}

export interface CompetencyScore {
  competency_item_id: string;
  score: number | null;
  feedback: string | null;
}

export interface CompetencyEvaluation {
  id: string;
  profile_id: string;
  cycle_id: string;
  evaluator_id: string;
  status: string;
  feedback_global: string | null;
  completed_at: string | null;
  profile_name?: string;
  scores?: CompetencyScore[];
}

export function useCompetencyCycles() {
  return useQuery({
    queryKey: ['competency', 'cycles'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get('/api/competency/cycles');
      // return response.data;
      return [];
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useActiveCycle() {
  const { data: cycles } = useCompetencyCycles();
  const now = new Date().toISOString().slice(0, 10);
  return cycles?.find(
    (c) => c.start_date <= now && c.end_date >= now
  ) ?? cycles?.[0] ?? null;
}

export function useCompetencyItems(cycleId: string | null) {
  return useQuery({
    queryKey: ['competency', 'items', cycleId],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/competency/cycles/${cycleId}/items`);
      // return response.data;
      return [];
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useMyCompetencyEvaluations(profileId?: string, options?: { enabled?: boolean }) {
  const pid = profileId;
  return useQuery({
    queryKey: ['competency', 'evaluations', pid ?? 'me'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/competency/evaluations?profile_id=${pid || 'me'}`);
      // return response.data;
      return [];
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useCompetencyEvaluation(evaluationId: string | null) {
  return useQuery({
    queryKey: ['competency', 'evaluation', evaluationId],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/competency/evaluations/${evaluationId}`);
      // return response.data;
      return null;
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useCreateOrUpdateCompetencyEvaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      cycleId,
      scores,
      feedbackGlobal,
      status,
    }: {
      profileId: string;
      cycleId: string;
      scores: { competency_item_id: string; score: number; feedback?: string }[];
      feedbackGlobal?: string;
      status?: 'draft' | 'completed';
    }) => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.post('/api/competency/evaluations', {
      //   profile_id: profileId,
      //   cycle_id: cycleId,
      //   scores,
      //   feedback_global: feedbackGlobal,
      //   status,
      // });
      // return response.data.id;
      throw new Error('Competency API not implemented yet - migrate to Laravel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competency'] });
    },
  });
}
