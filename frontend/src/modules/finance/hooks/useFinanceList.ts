import { useQuery } from '@tanstack/react-query';

import type { FinanceKind } from '../config';
import { getFinanceList } from '../services/financeService';
import type { IFinanceFilters } from '../types';
import { financeRoot } from './financeKeys';

export function useFinanceList(kind: FinanceKind, page: number, filters: IFinanceFilters, enabled = true) {
  return useQuery({
    queryKey: [...financeRoot(kind), 'list', page, filters],
    queryFn: () => getFinanceList(kind, page, filters),
    enabled,
    placeholderData: (previousData) => previousData,
  });
}
