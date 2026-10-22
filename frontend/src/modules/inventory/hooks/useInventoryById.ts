import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getInventoryById } from '../services/inventoryService';

export function useInventoryById(id: string) {
  return useQuery({
    queryKey: queryKeys.inventoryById(id),
    queryFn: () => getInventoryById(id),
    enabled: !!id,
  });
}
