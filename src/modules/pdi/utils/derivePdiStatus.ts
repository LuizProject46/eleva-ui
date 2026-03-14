import type { Pdi, PdiActionPlan, PdiPlanAction } from '@/types/pdi';

export type PdiProgressStatus = 'in_progress' | 'overdue' | 'completed';

function getTodayIsoDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function areAllPlanActionsCompleted(actions: PdiPlanAction[]): boolean {
  return actions.length > 0 && actions.every((a) => a.completed);
}

function hasOverdueIncompletePlan(
  actions: PdiPlanAction[],
  plans: PdiActionPlan[],
  todayIso: string
): boolean {
  const planIdsWithPastDue = new Set(
    plans.filter((p) => p.delivery_date != null && p.delivery_date < todayIso).map((p) => p.id)
  );
  if (planIdsWithPastDue.size === 0) return false;
  return actions.some(
    (a) => !a.completed && planIdsWithPastDue.has(a.pdi_action_plan_id)
  );
}

export function derivePdiStatus(
  _pdi: Pdi,
  planActions: PdiPlanAction[],
  actionPlans: PdiActionPlan[] = []
): PdiProgressStatus {
  if (areAllPlanActionsCompleted(planActions)) return 'completed';
  const todayIso = getTodayIsoDateUtc();
  if (hasOverdueIncompletePlan(planActions, actionPlans, todayIso)) return 'overdue';
  return 'in_progress';
}
