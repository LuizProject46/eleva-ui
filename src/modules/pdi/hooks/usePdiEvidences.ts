import { useQuery } from '@tanstack/react-query';

import { listPdiEvidencesByPdi } from '@/modules/pdi/services/pdiEvidenceService';
import type { PdiEvidence } from '@/types/pdi';

const PDI_EVIDENCES_STALE_MS = 60_000;
const PDI_EVIDENCES_GC_MS = 5 * 60_000;

export function usePdiEvidences(pdiId: string | null) {
  return useQuery({
    queryKey: ['pdiEvidences', pdiId],
    enabled: !!pdiId,
    staleTime: PDI_EVIDENCES_STALE_MS,
    gcTime: PDI_EVIDENCES_GC_MS,
    queryFn: async (): Promise<PdiEvidence[]> => {
      if (!pdiId) return [];
      const { data } = await listPdiEvidencesByPdi({
        pdiId,
        status: 'all',
        limit: 1000,
        offset: 0,
      });
      return data;
    },
  });
}

