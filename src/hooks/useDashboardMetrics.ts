/**
 * Role-aware dashboard metric hooks. Each hook fetches one metric via dashboardService.
 * Requests run in parallel when used together; each widget handles its own loading/error.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getTotalCollaborators,
  getTeamSize,
  getTotalPdis,
  getActivePdis,
  getOverdueActionPlans,
  getCloseToDeadlineActionPlans,
  getRecentActivity,
  getEmployeePdiSummary,
  getEvaluationCounts,
} from '@/services/dashboardService';
import type {
  DashboardRecentActivityItem,
  DashboardEmployeeMetrics,
  DashboardEvaluationCounts,
} from '@/types/dashboard';

const RECENT_ACTIVITY_LIMIT = 10;
const RECENT_ACTIVITY_LIMIT_EMPLOYEE = 5;

export interface UseDashboardMetricResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

function useDashboardMetric<T>(
  enabled: boolean,
  fetchFn: () => Promise<T>
): UseDashboardMetricResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fetchFn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error, isLoading, refetch: fetchData };
}

export function useTotalCollaborators(): UseDashboardMetricResult<number> {
  const { user } = useAuth();
  const enabled = user?.role === 'hr';
  return useDashboardMetric(enabled, getTotalCollaborators);
}

export function useTeamSize(): UseDashboardMetricResult<number> {
  const { user } = useAuth();
  const enabled = user?.role === 'manager';
  return useDashboardMetric(enabled, getTeamSize);
}

export function useTotalPdis(): UseDashboardMetricResult<number> {
  const { user } = useAuth();
  const enabled = user?.role === 'hr' || user?.role === 'manager';
  return useDashboardMetric(enabled, getTotalPdis);
}

export function useActivePdis(): UseDashboardMetricResult<number> {
  const { user } = useAuth();
  const enabled = user?.role === 'hr' || user?.role === 'manager';
  return useDashboardMetric(enabled, getActivePdis);
}

export function useOverdueActionPlans(): UseDashboardMetricResult<number> {
  const { user } = useAuth();
  const enabled = !!user;
  return useDashboardMetric(enabled, getOverdueActionPlans);
}

export function useCloseToDeadlineActionPlans(): UseDashboardMetricResult<number> {
  const { user } = useAuth();
  const enabled = !!user;
  return useDashboardMetric(enabled, getCloseToDeadlineActionPlans);
}

export function useRecentActivity(
  limit: number = RECENT_ACTIVITY_LIMIT
): UseDashboardMetricResult<DashboardRecentActivityItem[]> {
  const { user } = useAuth();
  const enabled = !!user;
  const effectiveLimit = user?.role === 'employee' ? RECENT_ACTIVITY_LIMIT_EMPLOYEE : limit;
  const fetchFn = useCallback(() => getRecentActivity(effectiveLimit), [effectiveLimit]);
  return useDashboardMetric(enabled, fetchFn);
}

export function useEmployeePdiSummary(): UseDashboardMetricResult<DashboardEmployeeMetrics> {
  const { user } = useAuth();
  const enabled = user?.role === 'employee';
  return useDashboardMetric(enabled, getEmployeePdiSummary);
}

/**
 * Evaluation counts (received, sent, self, teamSelf). RLS scopes teamSelf for manager/HR.
 */
export function useEvaluationCounts(): UseDashboardMetricResult<DashboardEvaluationCounts> {
  const { user } = useAuth();
  const enabled = !!user;
  return useDashboardMetric(enabled, getEvaluationCounts);
}
