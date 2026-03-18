import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Pdi, PdiActionPlan, PdiPlanAction } from '@/types/pdi';
import { derivePdiStatus, type PdiProgressStatus } from '@/modules/pdi/utils/derivePdiStatus';

const PLAN_MIN =
  'id, pdi_id, delivery_date, type, description, position, created_by, created_at, updated_at';
const ACTION_MIN =
  'id, pdi_action_plan_id, description, completed, position, created_at, updated_at';

export interface PdiListProgressEntry {
  pct: number;
  progressStatus: PdiProgressStatus;
  completed: number;
  total: number;
}

export const PDI_LIST_PROGRESS_DEFAULT: PdiListProgressEntry = {
  pct: 0,
  progressStatus: 'in_progress',
  completed: 0,
  total: 0,
};

const DUMMY_PDI = { id: '' } as Pdi;

function buildProgressMap(
  pdiIds: string[],
  plans: PdiActionPlan[],
  actions: PdiPlanAction[]
): Record<string, PdiListProgressEntry> {
  const map: Record<string, PdiListProgressEntry> = {};
  const plansByPdi = new Map<string, PdiActionPlan[]>();
  for (const pl of plans) {
    const list = plansByPdi.get(pl.pdi_id) ?? [];
    list.push(pl);
    plansByPdi.set(pl.pdi_id, list);
  }
  const planIds = new Set(plans.map((p) => p.id));
  const actionsByPlan = new Map<string, PdiPlanAction[]>();
  for (const a of actions) {
    if (!planIds.has(a.pdi_action_plan_id)) continue;
    const list = actionsByPlan.get(a.pdi_action_plan_id) ?? [];
    list.push(a);
    actionsByPlan.set(a.pdi_action_plan_id, list);
  }

  for (const pdiId of pdiIds) {
    const pdiPlans = plansByPdi.get(pdiId) ?? [];
    const pdiActions: PdiPlanAction[] = [];
    for (const pl of pdiPlans) {
      const acts = actionsByPlan.get(pl.id) ?? [];
      pdiActions.push(...acts);
    }
    const total = pdiActions.length;
    const completed = pdiActions.filter((a) => a.completed).length;
    const pct = total > 0 ? Math.round((100 * completed) / total) : 0;
    const progressStatus = derivePdiStatus(DUMMY_PDI, pdiActions, pdiPlans);
    map[pdiId] = { pct, progressStatus, completed, total };
  }
  return map;
}

export function usePdiListProgress(pdiIds: string[]) {
  const key = useMemo(() => [...pdiIds].sort().join(','), [pdiIds]);

  return useQuery({
    queryKey: ['pdi-list-progress', key],
    enabled: pdiIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, PdiListProgressEntry>> => {
      const ids = key.split(',').filter(Boolean);
      const { data: plansData, error: plansError } = await supabase
        .from('pdi_action_plans')
        .select(PLAN_MIN)
        .in('pdi_id', ids);
      if (plansError) throw plansError;
      const plans = (plansData ?? []) as PdiActionPlan[];
      const planIdList = plans.map((p) => p.id);
      let actions: PdiPlanAction[] = [];
      if (planIdList.length > 0) {
        const { data: actionsData, error: actionsError } = await supabase
          .from('pdi_plan_actions')
          .select(ACTION_MIN)
          .in('pdi_action_plan_id', planIdList);
        if (actionsError) throw actionsError;
        actions = (actionsData ?? []) as PdiPlanAction[];
      }
      return buildProgressMap(ids, plans, actions);
    },
  });
}
