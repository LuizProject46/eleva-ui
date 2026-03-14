/**
 * Dashboard metrics response from get-dashboard-metrics Edge Function.
 */

export type DashboardRole = 'hr' | 'manager' | 'employee';

export interface DashboardRecentActivityItem {
  pdiId: string;
  employeeName?: string | null;
  updatedAt: string;
  title?: string | null;
}

export interface DashboardHrMetrics {
  totalCollaborators: number;
  totalPdis: number;
  activePdis: number;
  overdueActionPlans: number;
  closeToDeadlineActionPlans: number;
}

export interface DashboardManagerMetrics {
  teamSize: number;
  totalPdis: number;
  activePdis: number;
  overdueActionPlans: number;
  closeToDeadlineActionPlans: number;
}

export interface DashboardEmployeeMetrics {
  hasActivePdi: boolean;
  activePdiId?: string | null;
  totalActionPlans: number;
  overdueActionPlans: number;
  closeToDeadlineActionPlans: number;
}

export type DashboardMetrics =
  | DashboardHrMetrics
  | DashboardManagerMetrics
  | DashboardEmployeeMetrics;

export interface DashboardMetricsResponse {
  role: DashboardRole;
  metrics: DashboardMetrics;
  recentActivity: DashboardRecentActivityItem[];
}

/** Evaluation counts for dashboard (from Evaluation page data). */
export interface DashboardEvaluationCounts {
  received: number;
  sent: number;
  self: number;
  teamSelf: number;
}
