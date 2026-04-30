import { supabase } from '@/lib/supabase';
import type {
  PerformanceObjectiveInsertInput,
  PerformanceObjectiveRow,
  PerformanceObjectiveUpdateInput,
} from '@/types/performanceObjective';

const SELECT_COLUMNS =
  'id, tenant_id, employee_id, title, description, sort_order, item_weight, rating, manager_comment, rated_by, rated_at, created_by, created_at, updated_at';

export async function listPerformanceObjectives(employeeId: string): Promise<PerformanceObjectiveRow[]> {
  const { data, error } = await supabase
    .from('performance_objectives')
    .select(SELECT_COLUMNS)
    .eq('employee_id', employeeId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PerformanceObjectiveRow[];
}

export async function insertPerformanceObjective(
  input: PerformanceObjectiveInsertInput
): Promise<PerformanceObjectiveRow> {
  const { data, error } = await supabase
    .from('performance_objectives')
    .insert({
      employee_id: input.employee_id,
      title: input.title,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
      item_weight: input.item_weight ?? 100,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;
  return data as PerformanceObjectiveRow;
}

/**
 * Inserts an objective; when existing weights already sum to 100%, the database
 * redistributes them so the new row receives `new_item_weight` (RPC).
 */
export async function insertPerformanceObjectiveAllocating(input: {
  employee_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  new_item_weight: number;
}): Promise<PerformanceObjectiveRow> {
  const { data, error } = await supabase.rpc('performance_objectives_insert_allocating', {
    p_employee_id: input.employee_id,
    p_title: input.title,
    p_description: input.description,
    p_sort_order: input.sort_order,
    p_new_weight: input.new_item_weight,
  });

  if (error) throw error;
  return data as PerformanceObjectiveRow;
}

export async function updatePerformanceObjective(
  id: string,
  patch: PerformanceObjectiveUpdateInput
): Promise<void> {
  const { error } = await supabase.from('performance_objectives').update(patch).eq('id', id);

  if (error) throw error;
}

export async function deletePerformanceObjective(id: string): Promise<void> {
  const { error } = await supabase.from('performance_objectives').delete().eq('id', id);

  if (error) throw error;
}
