import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { searchCustomers } from '../services/customerService';

export function useCustomerSearch(search: string) {
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  return useQuery({
    queryKey: ['customers', 'search', debouncedSearch],
    queryFn: () => searchCustomers(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}
