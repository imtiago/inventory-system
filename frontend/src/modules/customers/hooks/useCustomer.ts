import { useQuery } from '@tanstack/react-query';

import { getCustomerById } from '../services/customerService';
import { queryKeys } from '@/shared/react-query/keys';

export function useCustomer(id: string) {
  return useQuery({
    queryKey: [...queryKeys.customers, id],
    queryFn: () => getCustomerById(id),
    enabled: Boolean(id),
  });
}
