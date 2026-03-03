/**
 * PDI (Plano de Desenvolvimento Individual) service.
 * CRUD for pdis, objectives, actions, check-ins; list with pagination; progress RPC.
 */

import { supabase } from '@/lib/supabase';
import type {
  Pdi,
  PdiObjective,
  PdiAction,
  PdiCheckin,
  PdiProgress,
  PdiInsert,
  PdiObjectiveInsert,
  PdiActionInsert,
  PdiCheckinInsert,
  PdiCheckinUpdate,
} from '@/types/pdi';

const PDI_COLS =
  'id, tenant_id, employee_id, start_date, end_date, origin, evaluation_id, behavioral_assessment_id, status, closed_at, result, close_comment, created_by, created_at, updated_at';
const OBJECTIVE_COLS = 'id, pdi_id, description, competency, priority, due_date, position, status';
const ACTION_COLS =
  'id, pdi_objective_id, description, type, responsible_user_id, due_date, status, course_assignment_id, created_at, updated_at';
const CHECKIN_COLS =
  'id, pdi_id, checkin_date, overall_status, manager_comment, employee_comment, author_id, created_at';

export interface ListPdisOptions {
  employeeId?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
}

export interface ListPdisResult {
  data: Pdi[];
  total: number;
}

export async function listPdis(options: ListPdisOptions = {}): Promise<ListPdisResult> {
  const { employeeId, status, limit = 20, offset = 0 } = options;
  let query = supabase
    .from('pdis')
    .select(PDI_COLS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (employeeId && employeeId.trim()) {
    query = query.eq('employee_id', employeeId.trim());
  }
  if (status && status.trim()) {
    query = query.eq('status', status.trim());
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as Pdi[], total: count ?? 0 };
}

export async function getPdi(pdiId: string): Promise<Pdi | null> {
  const { data, error } = await supabase
    .from('pdis')
    .select(PDI_COLS)
    .eq('id', pdiId)
    .maybeSingle();
  if (error) throw error;
  return data as Pdi | null;
}

export async function createPdi(payload: PdiInsert): Promise<Pdi> {
  const { data, error } = await supabase
    .from('pdis')
    .insert({
      tenant_id: payload.tenant_id,
      employee_id: payload.employee_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      origin: payload.origin,
      evaluation_id: payload.evaluation_id ?? null,
      behavioral_assessment_id: payload.behavioral_assessment_id ?? null,
      created_by: payload.created_by ?? null,
    })
    .select(PDI_COLS)
    .single();
  if (error) throw error;
  return data as Pdi;
}

export async function updatePdi(
  pdiId: string,
  updates: Partial<Pick<Pdi, 'status' | 'closed_at' | 'result' | 'close_comment'>>
): Promise<Pdi> {
  const { data, error } = await supabase
    .from('pdis')
    .update(updates)
    .eq('id', pdiId)
    .select(PDI_COLS)
    .single();
  if (error) throw error;
  return data as Pdi;
}

export async function deletePdi(pdiId: string): Promise<void> {
  const { error } = await supabase.from('pdis').delete().eq('id', pdiId);
  if (error) throw error;
}

export async function listPdisByEmployee(employeeId: string): Promise<Pdi[]> {
  const { data, error } = await supabase
    .from('pdis')
    .select(PDI_COLS)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Pdi[];
}

// ——— Objectives ———
export async function listObjectives(pdiId: string): Promise<PdiObjective[]> {
  const { data, error } = await supabase
    .from('pdi_objectives')
    .select(OBJECTIVE_COLS)
    .eq('pdi_id', pdiId)
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PdiObjective[];
}

export async function createObjective(payload: PdiObjectiveInsert): Promise<PdiObjective> {
  const { data, error } = await supabase
    .from('pdi_objectives')
    .insert({
      pdi_id: payload.pdi_id,
      description: payload.description,
      competency: payload.competency ?? null,
      priority: payload.priority ?? null,
      due_date: payload.due_date ?? null,
      position: payload.position ?? 0,
      status: payload.status ?? 'not_started',
    })
    .select(OBJECTIVE_COLS)
    .single();
  if (error) throw error;
  return data as PdiObjective;
}

export async function updateObjective(
  objectiveId: string,
  updates: Partial<Pick<PdiObjective, 'description' | 'competency' | 'priority' | 'due_date' | 'position' | 'status'>>
): Promise<PdiObjective> {
  const { data, error } = await supabase
    .from('pdi_objectives')
    .update(updates)
    .eq('id', objectiveId)
    .select(OBJECTIVE_COLS)
    .single();
  if (error) throw error;
  return data as PdiObjective;
}

export async function deleteObjective(objectiveId: string): Promise<void> {
  const { error } = await supabase.from('pdi_objectives').delete().eq('id', objectiveId);
  if (error) throw error;
}

// ——— Actions ———
export async function listActionsByObjective(pdiObjectiveId: string): Promise<PdiAction[]> {
  const { data, error } = await supabase
    .from('pdi_actions')
    .select(ACTION_COLS)
    .eq('pdi_objective_id', pdiObjectiveId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PdiAction[];
}

export async function listActionsByPdi(pdiId: string): Promise<PdiAction[]> {
  const objectives = await listObjectives(pdiId);
  const actionLists = await Promise.all(objectives.map((o) => listActionsByObjective(o.id)));
  return actionLists.flat();
}

export async function createAction(payload: PdiActionInsert): Promise<PdiAction> {
  const { data, error } = await supabase
    .from('pdi_actions')
    .insert({
      pdi_objective_id: payload.pdi_objective_id,
      description: payload.description,
      type: payload.type,
      responsible_user_id: payload.responsible_user_id,
      due_date: payload.due_date ?? null,
      course_assignment_id: payload.course_assignment_id ?? null,
    })
    .select(ACTION_COLS)
    .single();
  if (error) throw error;
  return data as PdiAction;
}

export async function updateAction(
  actionId: string,
  updates: Partial<Pick<PdiAction, 'description' | 'type' | 'responsible_user_id' | 'due_date' | 'status' | 'course_assignment_id'>>
): Promise<PdiAction> {
  const { data, error } = await supabase
    .from('pdi_actions')
    .update(updates)
    .eq('id', actionId)
    .select(ACTION_COLS)
    .single();
  if (error) throw error;
  return data as PdiAction;
}

export async function updateActionStatus(actionId: string, status: PdiAction['status']): Promise<PdiAction> {
  return updateAction(actionId, { status });
}

export async function deleteAction(actionId: string): Promise<void> {
  const { error } = await supabase.from('pdi_actions').delete().eq('id', actionId);
  if (error) throw error;
}

// ——— Check-ins ———
export async function listCheckins(pdiId: string): Promise<PdiCheckin[]> {
  const { data, error } = await supabase
    .from('pdi_checkins')
    .select(CHECKIN_COLS)
    .eq('pdi_id', pdiId)
    .order('checkin_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PdiCheckin[];
}

export async function createCheckin(payload: PdiCheckinInsert): Promise<PdiCheckin> {
  const { data, error } = await supabase
    .from('pdi_checkins')
    .insert({
      pdi_id: payload.pdi_id,
      checkin_date: payload.checkin_date,
      overall_status: payload.overall_status,
      manager_comment: payload.manager_comment ?? null,
      employee_comment: payload.employee_comment ?? null,
      author_id: payload.author_id,
    })
    .select(CHECKIN_COLS)
    .single();
  if (error) throw error;
  return data as PdiCheckin;
}

export async function updateCheckin(
  checkinId: string,
  updates: PdiCheckinUpdate
): Promise<PdiCheckin> {
  const { data, error } = await supabase
    .from('pdi_checkins')
    .update(updates)
    .eq('id', checkinId)
    .select(CHECKIN_COLS)
    .single();
  if (error) throw error;
  return data as PdiCheckin;
}

// ——— Progress ———
export async function getPdiProgress(pdiId: string): Promise<PdiProgress | null> {
  const { data, error } = await supabase.rpc('get_pdi_progress', { p_pdi_id: pdiId });
  if (error) throw error;
  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row) return null;
  return {
    total_actions: Number(row.total_actions ?? 0),
    completed_actions: Number(row.completed_actions ?? 0),
    progress_pct: Number(row.progress_pct ?? 0),
  };
}
