import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { getInventoryByVariant } from '../services/inventoryService';

export function useVariantInventory(productVariantId?: string) {
  const query = useQuery({
    queryKey: queryKeys.inventoryByVariant(productVariantId ?? ''),
    queryFn: () => getInventoryByVariant(productVariantId as string),
    enabled: Boolean(productVariantId),
  });

  return {
    inventory: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? 'Não foi possível carregar o estoque da variante.' : null,
    reload: query.refetch,
  };
}
