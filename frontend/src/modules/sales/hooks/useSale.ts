import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { getSale } from '../services/saleService';

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.sales, 'detail', id],
    queryFn: () => getSale(id as string),
    enabled: !!id,
    // Do not retry a missing sale; keep the default (3 attempts) for other errors.
    retry: (count: number, err: unknown) => parseApiErrorSync(err).status !== 404 && count < 3,
  });
}
