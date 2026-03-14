import { describe, expect, it, vi } from 'vitest';

import { derivePdiStatus } from '@/modules/pdi/utils/derivePdiStatus';
import type { Pdi, PdiActionPlan, PdiPlanAction } from '@/types/pdi';

function makePdi(): Pdi {
  return {
    id: 'pdi-1',
    tenant_id: 't-1',
    employee_id: 'u-1',
    type: 'performance_improvement',
    title: null,
    status: 'active',
    closed_at: null,
    result: null,
    close_comment: null,
    created_by: 'u-2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makePlanAction(partial: Partial<PdiPlanAction>): PdiPlanAction {
  return {
    id: partial.id ?? 'a-1',
    pdi_action_plan_id: partial.pdi_action_plan_id ?? 'plan-1',
    description: partial.description ?? 'Action',
    completed: partial.completed ?? false,
    position: partial.position ?? 0,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
  };
}

function makeActionPlan(partial: Partial<PdiActionPlan>): PdiActionPlan {
  return {
    id: partial.id ?? 'plan-1',
    pdi_id: 'pdi-1',
    type: partial.type ?? 'training',
    delivery_date: partial.delivery_date ?? null,
    description: partial.description ?? null,
    position: partial.position ?? 0,
    created_by: partial.created_by ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
  };
}

describe('derivePdiStatus', () => {
  it('returns in_progress when there are no actions', () => {
    const pdi = makePdi();
    expect(derivePdiStatus(pdi, [], [])).toBe('in_progress');
  });

  it('returns completed when all plan actions are completed', () => {
    const pdi = makePdi();
    const actions = [
      makePlanAction({ id: 'a-1', completed: true }),
      makePlanAction({ id: 'a-2', completed: true }),
    ];
    expect(derivePdiStatus(pdi, actions, [])).toBe('completed');
  });

  it('returns overdue when a plan has past delivery_date and has incomplete action', () => {
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
    const pdi = makePdi();
    const plans = [makeActionPlan({ id: 'plan-1', delivery_date: '2026-03-09' })];
    const actions = [
      makePlanAction({ id: 'a-1', pdi_action_plan_id: 'plan-1', completed: false }),
      makePlanAction({ id: 'a-2', pdi_action_plan_id: 'plan-1', completed: true }),
    ];
    expect(derivePdiStatus(pdi, actions, plans)).toBe('overdue');
    vi.useRealTimers();
  });

  it('does not mark overdue when delivery_date is today', () => {
    vi.setSystemTime(new Date('2026-03-10T01:00:00Z'));
    const pdi = makePdi();
    const plans = [makeActionPlan({ id: 'plan-1', delivery_date: '2026-03-10' })];
    const actions = [makePlanAction({ pdi_action_plan_id: 'plan-1', completed: false })];
    expect(derivePdiStatus(pdi, actions, plans)).toBe('in_progress');
    vi.useRealTimers();
  });

  it('returns in_progress when actions exist but not all completed and no overdue plan', () => {
    const pdi = makePdi();
    const actions = [
      makePlanAction({ id: 'a-1', completed: true }),
      makePlanAction({ id: 'a-2', completed: false }),
    ];
    expect(derivePdiStatus(pdi, actions, [])).toBe('in_progress');
  });
});
