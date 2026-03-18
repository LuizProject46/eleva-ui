import { useQuery } from '@tanstack/react-query';

import { listPdis, type ListPdisOptions, type ListPdisResult } from '@/modules/pdi/services/pdiService';

const PDI_LIST_STALE_MS = 60_000;
const PDI_LIST_GC_MS = 5 * 60_000;

export function usePdis(options: ListPdisOptions) {
  const { employeeId, status, limit = 20, offset = 0 } = options;
  return useQuery<ListPdisResult>({
    queryKey: ['pdis', employeeId ?? null, status ?? null, limit, offset],
    queryFn: () => listPdis({ employeeId, status, limit, offset }),
    staleTime: PDI_LIST_STALE_MS,
    gcTime: PDI_LIST_GC_MS,
  });
}

