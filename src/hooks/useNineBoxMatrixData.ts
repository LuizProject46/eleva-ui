import { useQuery } from '@tanstack/react-query';

import { listNineBoxMatrixData } from '@/services/nineBoxService';
import type { NineBoxDataMode, NineBoxMatrixRow } from '@/types/nineBox';

interface UseNineBoxMatrixDataParams {
  tenantId: string | undefined;
  canAccess: boolean;
  periodId: string | null;
}

interface UseNineBoxMatrixDataResult {
  rows: NineBoxMatrixRow[];
  mode: NineBoxDataMode;
  periodName: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export function useNineBoxMatrixData({
  tenantId,
  canAccess,
  periodId,
}: UseNineBoxMatrixDataParams): UseNineBoxMatrixDataResult {
  const query = useQuery({
    queryKey: ['nine-box-matrix-data', tenantId, periodId ?? 'legacy'],
    queryFn: () => listNineBoxMatrixData(tenantId!, periodId),
    enabled: Boolean(tenantId && canAccess),
  });

  const mode: NineBoxDataMode = query.data?.mode ?? 'legacy';
  const rows = query.data?.rows ?? [];
  const periodName = query.data?.period?.name ?? null;

  return {
    rows,
    mode,
    periodName,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}
