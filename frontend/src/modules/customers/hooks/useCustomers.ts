import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '../services/customerService.ts';

export function useCustomers(page: number) {
  return useQuery({
    queryKey: ['customers', page],

    queryFn: () => getCustomers(page),

    placeholderData: (previousData) => previousData,
  });
}
