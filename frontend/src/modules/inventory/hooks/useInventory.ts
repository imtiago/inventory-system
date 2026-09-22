import { useQuery } from '@tanstack/react-query';
import { getInventory } from '../services/inventoryService.ts';

export function useInventory(page: number) {
  return useQuery({
    queryKey: ['inventory', page],

    queryFn: () => getInventory(page),

    placeholderData: (previousData) => previousData,
  });
}
