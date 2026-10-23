import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getSale } from '../services/saleService';

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.sales, 'detail', id],
    queryFn: () => getSale(id as string),
    enabled: !!id,
  });
}
