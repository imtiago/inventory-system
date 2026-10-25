import { useQuery } from '@tanstack/react-query';

import { getInventoryBalances, type InventoryBalance } from '../services/inventoryService';

/** Balances for a page of variants in a single request. Key lives under ['inventory'] so stock mutations invalidate it. */
export function useInventoryBalances(productVariantIds: string[]) {
  const ids = [...new Set(productVariantIds)].sort();

  const query = useQuery({
    queryKey: ['inventory', 'balances', ids],
    queryFn: () => getInventoryBalances(ids),
    enabled: ids.length > 0,
    placeholderData: (previous) => previous,
  });

  const balances = new Map<string, InventoryBalance>((query.data ?? []).map((balance) => [balance.productVariantId, balance]));

  return {
    balances,
    // isPlaceholderData: the previous page's balances are shown only to avoid flicker; the new ids are not loaded yet.
    loading: query.isLoading || query.isPlaceholderData,
    error: query.isError,
  };
}
