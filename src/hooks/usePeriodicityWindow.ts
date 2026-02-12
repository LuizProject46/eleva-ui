import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPeriodStatus,
  type PeriodicityConfigForCheck,
  type PeriodStatus,
  type PeriodStatusResult,
} from '@/lib/periodicity';

export type PeriodicityEntityType = 'evaluation' | 'assessment';

function formatDateBr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildMessage(
  entityLabel: string,
  result: PeriodStatusResult
): string | null {
  if (result.status === 'within' && result.currentPeriod) {
    return `${entityLabel} disponíveis de ${formatDateBr(result.currentPeriod.periodStart)} a ${formatDateBr(result.currentPeriod.periodEnd)}.`;
  }
  if (result.status === 'before' && result.nextPeriodStart) {
    return `${entityLabel} disponíveis a partir de ${formatDateBr(result.nextPeriodStart)}.`;
  }
  if (result.status === 'after' && result.nextPeriodStart) {
    return `Próximo período a partir de ${formatDateBr(result.nextPeriodStart)}.`;
  }
  return null;
}

export interface UsePeriodicityWindowResult {
  config: PeriodicityConfigForCheck | null;
  isWithinPeriod: boolean;
  periodStatus: PeriodStatus | null;
  currentPeriod: PeriodStatusResult['currentPeriod'];
  nextPeriodStart: string | null;
  nextPeriodStartAt: Date | null;
  message: string | null;
  isLoading: boolean;
}

const ENTITY_LABELS: Record<PeriodicityEntityType, string> = {
  evaluation: 'Avaliações 360°',
  assessment: 'Teste DISC',
};

export function usePeriodicityWindow(entityType: PeriodicityEntityType): UsePeriodicityWindowResult {
  const { user } = useAuth();
  const [config, setConfig] = useState<PeriodicityConfigForCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    if (!user?.tenantId) {
      setConfig(null);
      setIsLoading(false);
      return;
    }
    const { data } = await supabase
      .from('periodicity_config')
      .select('reference_start_date, interval_kind, custom_interval_days, custom_interval_months')
      .eq('tenant_id', user.tenantId)
      .eq('entity_type', entityType)
      .maybeSingle();
    setConfig(data as PeriodicityConfigForCheck | null);
    setIsLoading(false);
  }, [user?.tenantId, entityType]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const now = new Date();
  const result = config ? getPeriodStatus(config, now) : null;
  const isWithinPeriod = result === null ? true : result.status === 'within';
  const entityLabel = ENTITY_LABELS[entityType];
  const message = result ? buildMessage(entityLabel, result) : null;

  return {
    config,
    isWithinPeriod,
    periodStatus: result?.status ?? null,
    currentPeriod: result?.currentPeriod ?? null,
    nextPeriodStart: result?.nextPeriodStart ?? null,
    nextPeriodStartAt: result?.nextPeriodStartAt ?? null,
    message,
    isLoading,
  };
}
