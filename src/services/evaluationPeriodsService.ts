import { sortPeriodsByStartsAt } from '@/lib/evaluationPeriods';
import { supabase } from '@/lib/supabase';
import type { TenantEvaluationPeriod } from '@/types/evaluationPeriod';

export async function listTenantEvaluationPeriods(
  tenantId: string,
  options?: { order?: 'asc' | 'desc' }
): Promise<TenantEvaluationPeriod[]> {
  const order = options?.order ?? 'desc';
  const { data, error } = await supabase
    .from('evaluation_periods')
    .select('id, name, year, semester, starts_at, is_auto_generated, auto_cycle_start_date')
    .eq('tenant_id', tenantId)
    .or('source_entity_type.is.null,source_entity_type.eq.evaluation');

  if (error) throw error;
  const rows = (data ?? []) as TenantEvaluationPeriod[];
  return sortPeriodsByStartsAt(rows, order);
}
