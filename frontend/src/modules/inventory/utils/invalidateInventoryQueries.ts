import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';

/** Every stock mutation refreshes inventory, the variant's lots and every box search. */
export function invalidateInventoryQueries(queryClient: QueryClient, variantId?: string) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
    queryClient.invalidateQueries({ queryKey: [queryKeys.inventoryBoxes()[0]] }),
  ];

  if (variantId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.inventoryLots(variantId) }));
  }

  return Promise.all(tasks);
}
