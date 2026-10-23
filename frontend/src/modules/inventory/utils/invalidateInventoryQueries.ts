import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';

/** Every stock mutation refreshes inventory, the variant's lots and every box search. */
export function invalidateInventoryQueries(queryClient: QueryClient, variantId?: string) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
    queryClient.invalidateQueries({ queryKey: [queryKeys.inventoryBoxes()[0]] }),
  ];

  // Without a variant (e.g. a sale touching several), refresh every variant's lots.
  tasks.push(
    queryClient.invalidateQueries({
      queryKey: variantId ? queryKeys.inventoryLots(variantId) : [queryKeys.inventoryLots('')[0]],
    }),
  );

  return Promise.all(tasks);
}
