import { supabase } from '@/lib/supabase';
import { listTenantEvaluationPeriods } from '@/services/evaluationPeriodsService';
import type {
  NineBoxConfigRow,
  NineBoxConfigUpsertInput,
  NineBoxEvaluationPeriod,
  NineBoxMatrixDataResponse,
  NineBoxEvaluationSummary,
  NineBoxMatrixRow,
  NineBoxUpsertPayload,
} from '@/types/nineBox';

const MATRIX_SELECT = `
  id,
  employee_id,
  performance,
  potential,
  notes,
  evaluated_by,
  updated_at,
  profiles!nine_box_evaluations_employee_id_fkey (
    id,
    name,
    department,
    avatar_url,
    avatar_thumb_url
  )
`;

const SUMMARY_COLS = 'id, employee_id, performance, potential, updated_at';

interface CompetencyMatrixRpcRow {
  id: string;
  employee_id: string;
  performance: NineBoxMatrixRow['performance'];
  potential: NineBoxMatrixRow['potential'];
  notes: string | null;
  evaluated_by: string;
  updated_at: string;
  performance_score: number | null;
  potential_score: number | null;
  box_position: string | null;
  snapshot_status: 'complete' | 'incomplete';
  missing_competencies: string[] | null;
  period_id: string | null;
  profiles: NineBoxMatrixRow['profiles'] | NineBoxMatrixRow['profiles'][] | null;
}

interface PerformanceMatrixRpcRow {
  id: string;
  employee_id: string;
  performance: NineBoxMatrixRow['performance'];
  potential: NineBoxMatrixRow['potential'];
  notes: string | null;
  evaluated_by: string | null;
  updated_at: string;
  performance_score: number | null;
  potential_score: number | null;
  box_position: string | null;
  snapshot_status: 'complete' | 'incomplete';
  missing_competencies: string[] | null;
  period_id: string | null;
  profiles: NineBoxMatrixRow['profiles'] | NineBoxMatrixRow['profiles'][] | null;
  objectives_score: number | null;
  competencies_score: number | null;
  evaluation_year: number | null;
}

function normalizeProfileEmbed(
  row: NineBoxMatrixRow & { profiles?: NineBoxMatrixRow['profiles'] | NineBoxMatrixRow['profiles'][] }
): NineBoxMatrixRow {
  const raw = row.profiles;
  const profiles = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
  return { ...row, profiles };
}

export async function listNineBoxMatrixRows(tenantId: string): Promise<NineBoxMatrixRow[]> {
  const { data, error } = await supabase
    .from('nine_box_evaluations')
    .select(MATRIX_SELECT)
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...normalizeProfileEmbed(r as NineBoxMatrixRow),
    source_mode: 'legacy',
  }));
}

export async function listNineBoxEvaluationPeriods(tenantId: string): Promise<NineBoxEvaluationPeriod[]> {
  return listTenantEvaluationPeriods(tenantId, { order: 'desc' });
}

export async function getNineBoxEvaluationPeriod(
  tenantId: string,
  periodId: string
): Promise<NineBoxEvaluationPeriod | null> {
  const { data, error } = await supabase
    .from('evaluation_periods')
    .select('id, name, year, semester, starts_at, is_auto_generated, auto_cycle_start_date')
    .eq('tenant_id', tenantId)
    .eq('id', periodId)
    .or('source_entity_type.is.null,source_entity_type.eq.evaluation')
    .maybeSingle();

  if (error) throw error;
  return (data as NineBoxEvaluationPeriod | null) ?? null;
}

export async function listCompetencyNineBoxMatrixRows(
  tenantId: string,
  periodId: string
): Promise<NineBoxMatrixRow[]> {
  const { data, error } = await supabase.rpc('get_competency_nine_box_matrix', {
    p_tenant_id: tenantId,
    p_period_id: periodId,
  });

  if (error) throw error;

  return ((data ?? []) as CompetencyMatrixRpcRow[]).map((row) => {
    const normalized = normalizeProfileEmbed(row as unknown as NineBoxMatrixRow);
    return {
      ...normalized,
      source_mode: 'competency',
      period_id: row.period_id,
      performance_score: row.performance_score,
      potential_score: row.potential_score,
      position: row.box_position,
      snapshot_status: row.snapshot_status,
      missing_competencies: row.missing_competencies ?? [],
    };
  });
}

export async function listNineBoxMatrixData(
  tenantId: string,
  year: number
): Promise<NineBoxMatrixDataResponse> {
  const { data, error } = await supabase.rpc('get_performance_nine_box_matrix', {
    p_tenant_id: tenantId,
    p_year: year,
  });
  if (error) throw error;

  const rows = ((data ?? []) as PerformanceMatrixRpcRow[]).map((row) => {
    const normalized = normalizeProfileEmbed(row as unknown as NineBoxMatrixRow);
    return {
      ...normalized,
      source_mode: 'performance',
      period_id: row.period_id,
      performance_score: row.performance_score,
      potential_score: row.potential_score,
      objectives_score: row.objectives_score,
      competencies_score: row.competencies_score,
      evaluation_year: row.evaluation_year,
      position: row.box_position,
      snapshot_status: row.snapshot_status,
      missing_competencies: row.missing_competencies ?? [],
    };
  });

  return { mode: 'performance', period: null, rows };
}

export async function getNineBoxConfig(tenantId: string): Promise<NineBoxConfigRow | null> {
  const { data, error } = await supabase
    .from('nine_box_config')
    .select(
      'id, tenant_id, evaluation_year, objectives_low_max, objectives_medium_max, competencies_low_max, competencies_medium_max, created_at, updated_at'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  return (data as NineBoxConfigRow | null) ?? null;
}

export async function upsertNineBoxConfig(input: NineBoxConfigUpsertInput): Promise<NineBoxConfigRow> {
  const { data, error } = await supabase
    .from('nine_box_config')
    .upsert(input, { onConflict: 'tenant_id' })
    .select(
      'id, tenant_id, evaluation_year, objectives_low_max, objectives_medium_max, competencies_low_max, competencies_medium_max, created_at, updated_at'
    )
    .single();

  if (error) throw error;
  return data as NineBoxConfigRow;
}

export async function getNineBoxEvaluationByEmployee(
  tenantId: string,
  employeeId: string
): Promise<NineBoxEvaluationSummary | null> {
  const { data, error } = await supabase
    .from('nine_box_evaluations')
    .select(SUMMARY_COLS)
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) throw error;
  return data as NineBoxEvaluationSummary | null;
}

export async function getNineBoxEvaluationFullForModal(
  tenantId: string,
  employeeId: string
): Promise<{
  id: string;
  employee_id: string;
  performance: string;
  potential: string;
  notes: string | null;
} | null> {
  const { data, error } = await supabase
    .from('nine_box_evaluations')
    .select('id, employee_id, performance, potential, notes')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) throw error;
  return data as {
    id: string;
    employee_id: string;
    performance: string;
    potential: string;
    notes: string | null;
  } | null;
}

export async function upsertNineBoxEvaluation(payload: NineBoxUpsertPayload): Promise<void> {
  const { tenantId, employeeId, performance, potential, notes, evaluatedBy } = payload;
  const { error } = await supabase.from('nine_box_evaluations').upsert(
    {
      tenant_id: tenantId,
      employee_id: employeeId,
      performance,
      potential,
      notes: notes?.trim() ? notes.trim() : null,
      evaluated_by: evaluatedBy,
    },
    { onConflict: 'tenant_id,employee_id' }
  );

  if (error) throw error;
}
