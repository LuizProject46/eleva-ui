import { supabase } from '@/lib/supabase';

/** Row returned for objectives employee picklists (combobox). */
export interface ObjectivesEmployeeSearchRow {
  id: string;
  name: string;
  department: string | null;
}

export type ObjectivesEmployeeSearchScope =
  | { kind: 'hr_tenant_employees' }
  | { kind: 'manager_direct_reports'; managerId: string };

export interface ObjectivesEmployeeSearchParams {
  tenantId: string;
  excludeUserId: string;
  searchTerm: string;
  scope: ObjectivesEmployeeSearchScope;
  limit: number;
}

/**
 * Normalizes free text for PostgREST `ilike` + `.or()` filters: removes wildcards
 * and commas so the filter string cannot be broken or abused.
 */
export function sanitizeObjectivesEmployeeSearchTerm(raw: string): string {
  return raw.replace(/%/g, '').replace(/_/g, '').replace(/,/g, '').trim();
}

/** Wraps pattern for PostgREST `.or()` so dots (e.g. in e-mail) do not break parsing. */
function quotedIlikePattern(safeTerm: string): string {
  const escaped = safeTerm.replace(/"/g, '""');
  return `"%${escaped}%"`;
}

function buildMultiColumnOrFilter(safeTerm: string): string {
  const q = quotedIlikePattern(safeTerm);
  return [
    `name.ilike.${q}`,
    `email.ilike.${q}`,
    `department.ilike.${q}`,
    `position.ilike.${q}`,
  ].join(',');
}

/**
 * Lists active employees in the tenant for objectives UI, optionally scoped to a
 * manager’s direct reports. When `searchTerm` is non-empty, matches name, e-mail,
 * department, or position (OR).
 */
export async function searchObjectivesEmployees(params: ObjectivesEmployeeSearchParams) {
  const { tenantId, excludeUserId, searchTerm, scope, limit } = params;
  const safe = sanitizeObjectivesEmployeeSearchTerm(searchTerm);

  let query = supabase
    .from('profiles')
    .select('id, name, department')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('role', 'employee')
    .neq('id', excludeUserId)
    .order('name')
    .limit(limit);

  if (scope.kind === 'manager_direct_reports') {
    query = query.eq('manager_id', scope.managerId);
  }

  if (safe.length > 0) {
    query = query.or(buildMultiColumnOrFilter(safe));
  }

  return await query;
}
