import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createActionPlan,
  deleteActionPlan,
  listActionPlans,
  updateActionPlan,
} from '@/modules/pdi/services/pdiService';
import type { PdiActionPlanInsert, PdiActionPlanUpdate } from '@/types/pdi';

export function usePdiActionPlans(pdiId: string | null) {
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    enabled: !!pdiId,
    queryKey: ['pdiActionPlans', pdiId],
    queryFn: async () => {
      if (!pdiId) return [];
      return listActionPlans(pdiId);
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: (payload: PdiActionPlanInsert) => createActionPlan(payload),
    onSuccess: async () => {
      if (!pdiId) return;
      await queryClient.invalidateQueries({ queryKey: ['pdiActionPlans', pdiId] });
      await queryClient.invalidateQueries({ queryKey: ['pdiPlanActions', pdiId] });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ planId, updates }: { planId: string; updates: PdiActionPlanUpdate }) =>
      updateActionPlan(planId, updates),
    onSuccess: async () => {
      if (!pdiId) return;
      await queryClient.invalidateQueries({ queryKey: ['pdiActionPlans', pdiId] });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => deleteActionPlan(planId),
    onSuccess: async () => {
      if (!pdiId) return;
      await queryClient.invalidateQueries({ queryKey: ['pdiActionPlans', pdiId] });
      await queryClient.invalidateQueries({ queryKey: ['pdiPlanActions', pdiId] });
    },
  });

  return {
    ...plansQuery,
    createPlan: createPlanMutation,
    updatePlan: updatePlanMutation,
    deletePlan: deletePlanMutation,
  };
}
