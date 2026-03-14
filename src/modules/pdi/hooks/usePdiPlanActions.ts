import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createPlanAction,
  deletePlanAction,
  listPlanActionsByPdi,
  updatePlanAction,
} from '@/modules/pdi/services/pdiService';
import type { PdiPlanActionInsert, PdiPlanActionUpdate } from '@/types/pdi';

export function usePdiPlanActions(pdiId: string | null) {
  const queryClient = useQueryClient();

  const actionsQuery = useQuery({
    enabled: !!pdiId,
    queryKey: ['pdiPlanActions', pdiId],
    queryFn: async () => {
      if (!pdiId) return [];
      return listPlanActionsByPdi(pdiId);
    },
  });

  const createActionMutation = useMutation({
    mutationFn: (payload: PdiPlanActionInsert) => createPlanAction(payload),
    onSuccess: async () => {
      if (!pdiId) return;
      await queryClient.invalidateQueries({ queryKey: ['pdiPlanActions', pdiId] });
      await queryClient.invalidateQueries({ queryKey: ['pdiActionPlans', pdiId] });
    },
  });

  const updateActionMutation = useMutation({
    mutationFn: ({ actionId, updates }: { actionId: string; updates: PdiPlanActionUpdate }) =>
      updatePlanAction(actionId, updates),
    onSuccess: async () => {
      if (!pdiId) return;
      await queryClient.invalidateQueries({ queryKey: ['pdiPlanActions', pdiId] });
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: (actionId: string) => deletePlanAction(actionId),
    onSuccess: async () => {
      if (!pdiId) return;
      await queryClient.invalidateQueries({ queryKey: ['pdiPlanActions', pdiId] });
    },
  });

  return {
    ...actionsQuery,
    createAction: createActionMutation,
    updateAction: updateActionMutation,
    deleteAction: deleteActionMutation,
  };
}
