import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getSales } from '../services/saleService';
import type { ISaleFilters } from '../types';

export function useSales(page: number, filters: ISaleFilters = {}, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.sales, 'list', page, filters],
    queryFn: () => getSales(page, filters),
    placeholderData: (previousData) => previousData,
    enabled,
  });
}
