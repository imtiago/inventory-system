import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getInventoryLots } from '../services/inventoryService';

export function useInventoryLots(variantId?: string, opts: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 10 } = opts;

  const query = useQuery({
    queryKey: [...queryKeys.inventoryLots(variantId ?? ''), { page, limit }],
    queryFn: () => getInventoryLots(variantId as string, { page, limit }),
    enabled: Boolean(variantId),
  });

  return {
    lots: query.data?.data ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    error: query.error,
  };
}
