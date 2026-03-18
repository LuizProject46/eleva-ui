import { supabase } from '@/lib/supabase';
import type {
  Pdi,
  PdiListRow,
  PdiInsert,
  PdiActionPlan,
  PdiActionPlanInsert,
  PdiActionPlanUpdate,
  PdiPlanAction,
  PdiPlanActionInsert,
  PdiPlanActionUpdate,
} from '@/types/pdi';

const PDI_COLS =
  'id, tenant_id, employee_id, type, title, status, closed_at, result, close_comment, created_by, created_at, updated_at';

const PDI_LIST_COLS = 'id, employee_id, type, title, status, created_at';

const ACTION_PLAN_COLS =
  'id, pdi_id, type, delivery_date, description, position, created_by, created_at, updated_at, reminder_sent_at';

const PLAN_ACTION_COLS =
  'id, pdi_action_plan_id, description, completed, position, created_at, updated_at';

const DELIVERY_DATE_PAST_ERROR = 'A data de entrega não pode ser no passado.';

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDeliveryDateInPast(dateStr: string): boolean {
  const trimmed = dateStr?.trim();
  if (!trimmed) return false;
  return trimmed < getTodayIso();
}

export interface ListPdisOptions {
  employeeId?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
}

export interface ListPdisResult {
  data: PdiListRow[];
  total: number;
}

export async function listPdis(options: ListPdisOptions = {}): Promise<ListPdisResult> {
  const { employeeId, status, limit = 20, offset = 0 } = options;
  let query = supabase
    .from('pdis')
    .select(PDI_LIST_COLS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (employeeId?.trim()) {
    query = query.eq('employee_id', employeeId.trim());
  }
  if (status?.trim()) {
    query = query.eq('status', status.trim());
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as PdiListRow[], total: count ?? 0 };
}

export async function getPdi(pdiId: string): Promise<Pdi | null> {
  const { data, error } = await supabase.from('pdis').select(PDI_COLS).eq('id', pdiId).maybeSingle();
  if (error) throw error;
  return data as Pdi | null;
}

export async function createPdi(payload: PdiInsert): Promise<Pdi> {
  const { data, error } = await supabase
    .from('pdis')
    .insert({
      tenant_id: payload.tenant_id,
      employee_id: payload.employee_id,
      type: payload.type,
      title: payload.title ?? null,
      created_by: payload.created_by ?? null,
    })
    .select(PDI_COLS)
    .single();
  if (error) throw error;
  return data as Pdi;
}

export async function updatePdi(
  pdiId: string,
  updates: Partial<Pick<Pdi, 'status' | 'closed_at' | 'result' | 'close_comment' | 'title' | 'type'>>
): Promise<Pdi> {
  const { data, error } = await supabase.from('pdis').update(updates).eq('id', pdiId).select(PDI_COLS).single();
  if (error) throw error;
  return data as Pdi;
}

// Action plans
export async function listActionPlans(pdiId: string): Promise<PdiActionPlan[]> {
  const { data, error } = await supabase
    .from('pdi_action_plans')
    .select(ACTION_PLAN_COLS)
    .eq('pdi_id', pdiId)
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PdiActionPlan[];
}

export async function createActionPlan(payload: PdiActionPlanInsert): Promise<PdiActionPlan> {
  if (!payload.description?.trim() || !payload.delivery_date?.trim()) {
    throw new Error('Descrição e data de entrega são obrigatórios.');
  }
  if (isDeliveryDateInPast(payload.delivery_date)) {
    throw new Error(DELIVERY_DATE_PAST_ERROR);
  }
  const { data, error } = await supabase
    .from('pdi_action_plans')
    .insert({
      pdi_id: payload.pdi_id,
      type: payload.type,
      delivery_date: payload.delivery_date.trim(),
      description: payload.description.trim(),
      position: payload.position ?? 0,
      created_by: payload.created_by,
    })
    .select(ACTION_PLAN_COLS)
    .single();
  if (error) throw error;
  return data as PdiActionPlan;
}

export async function updateActionPlan(
  planId: string,
  updates: PdiActionPlanUpdate
): Promise<PdiActionPlan> {
  if (updates.delivery_date != null && isDeliveryDateInPast(updates.delivery_date)) {
    throw new Error(DELIVERY_DATE_PAST_ERROR);
  }
  const { data, error } = await supabase
    .from('pdi_action_plans')
    .update(updates)
    .eq('id', planId)
    .select(ACTION_PLAN_COLS)
    .single();
  if (error) throw error;
  return data as PdiActionPlan;
}

export async function deleteActionPlan(planId: string): Promise<void> {
  const { error } = await supabase.from('pdi_action_plans').delete().eq('id', planId);
  if (error) throw error;
}

// Plan actions (checklist items)
export async function listPlanActionsByPdi(pdiId: string): Promise<PdiPlanAction[]> {
  const { data: plans } = await supabase
    .from('pdi_action_plans')
    .select('id')
    .eq('pdi_id', pdiId);
  const planIds = (plans ?? []).map((p) => p.id);
  if (planIds.length === 0) return [];
  const { data, error } = await supabase
    .from('pdi_plan_actions')
    .select(PLAN_ACTION_COLS)
    .in('pdi_action_plan_id', planIds)
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PdiPlanAction[];
}

export async function listPlanActionsByPlanId(planId: string): Promise<PdiPlanAction[]> {
  const { data, error } = await supabase
    .from('pdi_plan_actions')
    .select(PLAN_ACTION_COLS)
    .eq('pdi_action_plan_id', planId)
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PdiPlanAction[];
}

export async function createPlanAction(payload: PdiPlanActionInsert): Promise<PdiPlanAction> {
  const { data, error } = await supabase
    .from('pdi_plan_actions')
    .insert({
      pdi_action_plan_id: payload.pdi_action_plan_id,
      description: payload.description,
      completed: payload.completed ?? false,
      position: payload.position ?? 0,
    })
    .select(PLAN_ACTION_COLS)
    .single();
  if (error) throw error;
  return data as PdiPlanAction;
}

export async function updatePlanAction(
  actionId: string,
  updates: PdiPlanActionUpdate
): Promise<PdiPlanAction> {
  const { data, error } = await supabase
    .from('pdi_plan_actions')
    .update(updates)
    .eq('id', actionId)
    .select(PLAN_ACTION_COLS)
    .single();
  if (error) throw error;
  return data as PdiPlanAction;
}

export async function deletePlanAction(actionId: string): Promise<void> {
  const { error } = await supabase.from('pdi_plan_actions').delete().eq('id', actionId);
  if (error) throw error;
}
