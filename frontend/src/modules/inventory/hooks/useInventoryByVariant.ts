import { useQuery } from '@tanstack/react-query';
import { getInventoryByVariant } from '../services/inventoryService';

export function useInventoryByVariant(variantId: string) {
  return useQuery({
    queryKey: ['inventory', 'variant', variantId],
    queryFn: () => getInventoryByVariant(variantId),
    enabled: Boolean(variantId),
    retry: false,
  });
}
