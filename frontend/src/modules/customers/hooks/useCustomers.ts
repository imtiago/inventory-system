import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '../services/customerService.ts';

export function useCustomers(page: number, search: string = '') {
  return useQuery({
    queryKey: ['customers', page, search],

    queryFn: () => getCustomers(page, search.trim()),

    placeholderData: (previousData) => previousData,
  });
}
