import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getProfitReport, getSellerOptions } from '../services/profitService';
import type { IProfitFilters } from '../types';

export function useProfitReport(filters: IProfitFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.profitReport(filters),
    queryFn: () => getProfitReport(filters),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSellerOptions() {
  return useQuery({ queryKey: ['users', 'seller-options'], queryFn: getSellerOptions, staleTime: 5 * 60_000 });
}
