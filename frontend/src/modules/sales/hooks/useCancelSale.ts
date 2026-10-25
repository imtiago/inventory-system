import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { notify } from '@/shared/utils/notify';
import { invalidateInventoryQueries } from '@/modules/inventory/utils/invalidateInventoryQueries';
import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import { saleMessages } from '../config/messages';
import { cancelSale } from '../services/saleService';

export function useCancelSale(id: string) {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: () => keys.run(id, (key) => cancelSale(id, key)),

    async onSuccess(sale) {
      queryClient.setQueryData([...queryKeys.sales, 'detail', id], sale);
      // Refresh lists only; the detail was just set from the response.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.sales,
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
      // Cancelling returns stock and cancels the receivable.
      await Promise.all([
        invalidateInventoryQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.receivables }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      notify.success(saleMessages.canceled);
    },
    // The page renders the backend message itself.
  });
}
