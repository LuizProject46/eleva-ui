import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// TODO: Migrar para API REST Laravel - escopo separado
// import api from '@/lib/api';

export type DiscValue = 'D' | 'I' | 'S' | 'C';

export interface DiscQuestion {
  id: string;
  order: number;
  text: string;
  options: { value: DiscValue; text: string }[];
}

export interface DiscAssessment {
  id: string;
  profile_id: string;
  evaluator_id: string;
  evaluator_type: 'self' | 'manager' | 'hr';
  status: string;
  completed_at: string | null;
  profiles?: { name: string };
}

export function useDiscQuestions() {
  return useQuery({
    queryKey: ['disc', 'questions'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get('/api/disc/questions');
      // return response.data;
      return [] as DiscQuestion[];
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useDiscAssessment(
  profileId: string | undefined,
  evaluatorType: 'self' | 'manager' | 'hr',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['disc', 'assessment', profileId, evaluatorType],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/disc/assessments/${profileId}?evaluator_type=${evaluatorType}`);
      // return response.data;
      return null;
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useDiscAnswers(assessmentId: string | null) {
  return useQuery({
    queryKey: ['disc', 'answers', assessmentId],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/disc/answers/${assessmentId}`);
      // return response.data;
      return [] as { question_id: string; value: DiscValue }[];
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useDiscAssessmentsByProfile(profileId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['disc', 'assessments', profileId],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/disc/assessments?profile_id=${profileId}&status=completed`);
      // return response.data;
      return [];
    },
    enabled: false, // Desabilitar até migração
  });
}

function calculateDominant(answers: { value: DiscValue }[]): DiscValue {
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  answers.forEach((a) => {
    counts[a.value]++;
  });
  return (['D', 'I', 'S', 'C'] as const).reduce((a, b) => (counts[a] >= counts[b] ? a : b));
}

export function useCreateDiscAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      evaluatorType,
      answers,
    }: {
      profileId: string;
      evaluatorType: 'self' | 'manager' | 'hr';
      answers: Record<string, DiscValue>;
    }) => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.post('/api/disc/assessments', {
      //   profile_id: profileId,
      //   evaluator_type: evaluatorType,
      //   answers,
      // });
      // return response.data;
      throw new Error('DISC API not implemented yet - migrate to Laravel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disc'] });
    },
  });
}
