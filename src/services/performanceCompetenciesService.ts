import { supabase } from '@/lib/supabase';
import type {
  EvaluationCompetencyRow,
  PerformanceCompetencyAssignmentInsertInput,
  PerformanceCompetencyAssignmentRow,
  PerformanceCompetencyAssignmentUpdateInput,
  PerformanceCompetencyEvaluationRow,
  PerformanceCompetencyEvaluationUpsertInput,
} from '@/types/performanceCompetency';

const COMPETENCY_CATALOG_SELECT = 'id, name, description, "order"';
const ASSIGNMENT_SELECT =
  'id, tenant_id, employee_id, competency_id, item_weight, created_by, created_at, updated_at';
const EVALUATION_SELECT =
  'id, tenant_id, employee_id, competency_id, rating, manager_comment, rated_by, rated_at, submitted_by, submitted_at, created_at, updated_at';

export async function listEvaluationCompetencies(): Promise<EvaluationCompetencyRow[]> {
  const { data, error } = await supabase
    .from('evaluation_competencies')
    .select(COMPETENCY_CATALOG_SELECT)
    .order('order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as EvaluationCompetencyRow[];
}

export async function listPerformanceCompetencyAssignments(
  employeeId: string
): Promise<PerformanceCompetencyAssignmentRow[]> {
  const { data, error } = await supabase
    .from('performance_competency_assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PerformanceCompetencyAssignmentRow[];
}

export async function insertPerformanceCompetencyAssignment(
  input: PerformanceCompetencyAssignmentInsertInput
): Promise<PerformanceCompetencyAssignmentRow> {
  const { data, error } = await supabase
    .from('performance_competency_assignments')
    .insert({
      employee_id: input.employee_id,
      competency_id: input.competency_id,
      item_weight: input.item_weight,
    })
    .select(ASSIGNMENT_SELECT)
    .single();

  if (error) throw error;
  return data as PerformanceCompetencyAssignmentRow;
}

export async function updatePerformanceCompetencyAssignment(
  id: string,
  patch: PerformanceCompetencyAssignmentUpdateInput
): Promise<void> {
  const { error } = await supabase.from('performance_competency_assignments').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePerformanceCompetencyAssignment(id: string): Promise<void> {
  const { error } = await supabase.from('performance_competency_assignments').delete().eq('id', id);
  if (error) throw error;
}

export async function listPerformanceCompetencyEvaluations(
  employeeId: string
): Promise<PerformanceCompetencyEvaluationRow[]> {
  const { data, error } = await supabase
    .from('performance_competency_evaluations')
    .select(EVALUATION_SELECT)
    .eq('employee_id', employeeId);

  if (error) throw error;
  return (data ?? []) as PerformanceCompetencyEvaluationRow[];
}

export async function upsertPerformanceCompetencyEvaluation(
  input: PerformanceCompetencyEvaluationUpsertInput
): Promise<PerformanceCompetencyEvaluationRow> {
  const { data, error } = await supabase
    .from('performance_competency_evaluations')
    .upsert(
      {
        employee_id: input.employee_id,
        competency_id: input.competency_id,
        rating: input.rating,
        manager_comment: input.manager_comment ?? null,
      },
      { onConflict: 'employee_id,competency_id' }
    )
    .select(EVALUATION_SELECT)
    .single();

  if (error) throw error;
  return data as PerformanceCompetencyEvaluationRow;
}

export async function submitPerformanceCompetenciesEvaluation(employeeId: string): Promise<void> {
  const { error } = await supabase.rpc('performance_competencies_submit', { p_employee_id: employeeId });
  if (error) throw error;
}
