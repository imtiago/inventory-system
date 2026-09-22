import { useQuery } from '@tanstack/react-query';

import { getInventoryById } from '../services/inventoryService';

export function useInventoryById(id: string) {
  return useQuery({
    queryKey: ['inventory', id],

    queryFn: () => getInventoryById(id),

    enabled: !!id,
  });
}
