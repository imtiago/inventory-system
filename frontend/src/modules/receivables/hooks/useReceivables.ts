import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getReceivables } from '../services/receivableService';
import type { IReceivableFilters } from '../types';

export function useReceivables(page: number, filters: IReceivableFilters) {
  return useQuery({
    queryKey: [...queryKeys.receivables, 'list', page, filters],
    queryFn: () => getReceivables(page, filters),
    placeholderData: (previousData) => previousData,
  });
}
