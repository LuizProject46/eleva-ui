import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// TODO: Migrar para API REST Laravel - escopo separado
// import api from '@/lib/api';

export interface IDPAction {
  id: string;
  objective_id: string;
  order: number;
  title: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
}

export interface IDPObjective {
  id: string;
  plan_id: string;
  order: number;
  title: string;
  description: string | null;
  status: string;
  actions: IDPAction[];
}

export interface IDPPlan {
  id: string;
  profile_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: string;
  created_by: string | null;
  objectives?: IDPObjective[];
  profile_name?: string;
}

export function useIDPPlans(profileId?: string) {
  const pid = profileId;
  return useQuery({
    queryKey: ['idp', 'plans', pid ?? 'me'],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/idp/plans?profile_id=${pid || 'me'}`);
      // return response.data;
      return [];
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useIDPPlan(planId: string | null) {
  return useQuery({
    queryKey: ['idp', 'plan', planId],
    queryFn: async () => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.get(`/api/idp/plans/${planId}`);
      // return response.data;
      return null;
    },
    enabled: false, // Desabilitar até migração
  });
}

export function useCreateIDPPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      title,
      periodStart,
      periodEnd,
      objectives,
    }: {
      profileId: string;
      title: string;
      periodStart?: string;
      periodEnd?: string;
      objectives?: { title: string; description?: string; actions?: { title: string; dueDate?: string }[] }[];
    }) => {
      // TODO: Implementar chamada para API Laravel
      // const response = await api.post('/api/idp/plans', {
      //   profile_id: profileId,
      //   title,
      //   period_start: periodStart,
      //   period_end: periodEnd,
      //   objectives,
      // });
      // return response.data.id;
      throw new Error('IDP API not implemented yet - migrate to Laravel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idp'] });
    },
  });
}

export function useToggleIDPAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionId, completed }: { actionId: string; completed: boolean }) => {
      // TODO: Implementar chamada para API Laravel
      // await api.patch(`/api/idp/actions/${actionId}`, {
      //   status: completed ? 'completed' : 'pending',
      //   completed_at: completed ? new Date().toISOString() : null,
      // });
      throw new Error('IDP API not implemented yet - migrate to Laravel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idp'] });
    },
  });
}
