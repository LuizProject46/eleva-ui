/**
 * Dashboard data layer — one optimized Supabase query per metric.
 * Uses the current session; RLS enforces tenant and role scope.
 */

import { supabase } from '@/lib/supabase';
import type {
  DashboardRecentActivityItem,
  DashboardRole,
  DashboardEmployeeMetrics,
  DashboardEvaluationCounts,
} from '@/types/dashboard';

const CLOSE_TO_DEADLINE_DAYS = 7;
const RECENT_ACTIVITY_LIMIT = 10;
const RECENT_ACTIVITY_LIMIT_EMPLOYEE = 5;

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function getCurrentUserId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user?.id) {
    throw new Error('Sessão inválida.');
  }
  return session.user.id;
}

/**
 * HR: count of active collaborators in tenant (RLS scopes to tenant).
 */
export async function getTotalCollaborators(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Manager: count of profiles where manager_id = current user.
 */
export async function getTeamSize(): Promise<number> {
  const userId = await getCurrentUserId();
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', userId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * HR / Manager: total PDIs visible to user (RLS scopes by tenant or team).
 */
export async function getTotalPdis(): Promise<number> {
  const { count, error } = await supabase
    .from('pdis')
    .select('id', { count: 'exact', head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * HR / Manager: PDIs with status = active.
 */
export async function getActivePdis(): Promise<number> {
  const { count, error } = await supabase
    .from('pdis')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * All roles: action plans with delivery_date < today (RLS scopes by role).
 */
export async function getOverdueActionPlans(): Promise<number> {
  const today = toDateOnly(new Date());
  const { count, error } = await supabase
    .from('pdi_action_plans')
    .select('id', { count: 'exact', head: true })
    .lt('delivery_date', today);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * All roles: action plans with delivery_date in [today, today + CLOSE_TO_DEADLINE_DAYS].
 */
export async function getCloseToDeadlineActionPlans(): Promise<number> {
  const today = toDateOnly(new Date());
  const d = new Date();
  d.setDate(d.getDate() + CLOSE_TO_DEADLINE_DAYS);
  const nextWeek = toDateOnly(d);

  const { count, error } = await supabase
    .from('pdi_action_plans')
    .select('id', { count: 'exact', head: true })
    .gte('delivery_date', today)
    .lte('delivery_date', nextWeek);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Recent PDI activity. For HR/Manager returns items with employee names; for employee, only own PDIs.
 */
export async function getRecentActivity(
  limit: number = RECENT_ACTIVITY_LIMIT,
  userRole: DashboardRole
): Promise<DashboardRecentActivityItem[]> {
  const userId = await getCurrentUserId();
  const isEmployee = userRole === 'employee';
  const actualLimit = isEmployee ? Math.min(limit, RECENT_ACTIVITY_LIMIT_EMPLOYEE) : limit;

  if (isEmployee) {
    const { data: rows, error } = await supabase
      .from('pdis')
      .select('id, updated_at, title')
      .eq('employee_id', userId)
      .order('updated_at', { ascending: false })
      .limit(actualLimit);

    if (error) throw new Error(error.message);

    const items = (rows ?? []).map((row: { id: string; updated_at: string; title: string | null }) => ({
      pdiId: row.id,
      employeeName: null,
      updatedAt: row.updated_at,
      title: row.title ?? null,
    }));
    return items;
  }

  const { data: rows, error } = await supabase
    .from('pdis')
    .select('id, updated_at, title, employee_id')
    .order('updated_at', { ascending: false })
    .limit(actualLimit);

  if (error) throw new Error(error.message);

  const activityRows = (rows ?? []) as Array<{
    id: string;
    updated_at: string;
    title: string | null;
    employee_id: string;
  }>;
  const employeeIds = [...new Set(activityRows.map((r) => r.employee_id).filter(Boolean))];
  const nameMap: Record<string, string> = {};

  if (employeeIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', employeeIds);
    (profiles ?? []).forEach((p: { id: string; name: string | null }) => {
      nameMap[p.id] = p.name ?? '';
    });
  }

  return activityRows.map((row) => ({
    pdiId: row.id,
    employeeName: row.employee_id ? nameMap[row.employee_id] ?? null : null,
    updatedAt: row.updated_at,
    title: row.title ?? null,
  }));
}

/**
 * Employee: active PDI id + action plan counts (total, overdue, close to deadline).
 */
export async function getEmployeePdiSummary(): Promise<DashboardEmployeeMetrics> {
  const userId = await getCurrentUserId();
  const today = toDateOnly(new Date());
  const d = new Date();
  d.setDate(d.getDate() + CLOSE_TO_DEADLINE_DAYS);
  const nextWeek = toDateOnly(d);

  const [activePdiRes, totalRes, overdueRes, closeRes] = await Promise.all([
    supabase
      .from('pdis')
      .select('id')
      .eq('employee_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('pdi_action_plans')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('pdi_action_plans')
      .select('id', { count: 'exact', head: true })
      .lt('delivery_date', today),
    supabase
      .from('pdi_action_plans')
      .select('id', { count: 'exact', head: true })
      .gte('delivery_date', today)
      .lte('delivery_date', nextWeek),
  ]);

  if (activePdiRes.error) throw new Error(activePdiRes.error.message);
  if (totalRes.error) throw new Error(totalRes.error.message);
  if (overdueRes.error) throw new Error(overdueRes.error.message);
  if (closeRes.error) throw new Error(closeRes.error.message);

  const activePdi = activePdiRes.data as { id: string } | null;
  const activePdiId = activePdi?.id ?? null;

  return {
    hasActivePdi: !!activePdiId,
    activePdiId,
    totalActionPlans: totalRes.count ?? 0,
    overdueActionPlans: overdueRes.count ?? 0,
    closeToDeadlineActionPlans: closeRes.count ?? 0,
  };
}

/**
 * Evaluation counts for dashboard (aligned with Evaluation page).
 * All counts use submitted evaluations only; RLS enforces tenant and role.
 */
export async function getEvaluationCounts(): Promise<DashboardEvaluationCounts> {
  const userId = await getCurrentUserId();

  const [receivedRes, sentRes, selfRes, teamSelfRes] = await Promise.all([
    supabase
      .from('evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('evaluated_id', userId)
      .eq('status', 'submitted')
      .neq('type', 'self'),
    supabase
      .from('evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('evaluator_id', userId)
      .eq('status', 'submitted')
      .neq('type', 'self'),
    supabase
      .from('evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('evaluator_id', userId)
      .eq('evaluated_id', userId)
      .eq('type', 'self')
      .eq('status', 'submitted'),
    supabase
      .from('evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'self')
      .eq('status', 'submitted'),
  ]);

  if (receivedRes.error) throw new Error(receivedRes.error.message);
  if (sentRes.error) throw new Error(sentRes.error.message);
  if (selfRes.error) throw new Error(selfRes.error.message);
  if (teamSelfRes.error) throw new Error(teamSelfRes.error.message);

  return {
    received: receivedRes.count ?? 0,
    sent: sentRes.count ?? 0,
    self: selfRes.count ?? 0,
    teamSelf: teamSelfRes.count ?? 0,
  };
}
