import { useQuery } from '@tanstack/react-query';

import { listPdis, type ListPdisOptions, type ListPdisResult } from '@/modules/pdi/services/pdiService';

export function usePdis(options: ListPdisOptions) {
  return useQuery<ListPdisResult>({
    queryKey: ['pdis', options],
    queryFn: () => listPdis(options),
  });
}

