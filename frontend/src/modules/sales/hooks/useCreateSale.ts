import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { notify } from '@/shared/utils/notify';
import { invalidateInventoryQueries } from '@/modules/inventory/utils/invalidateInventoryQueries';
import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import { saleMessages } from '../config/messages';
import type { ICreateSaleDTO } from '../types';
import { createSale } from '../services/saleService';

export function useCreateSale() {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: (data: ICreateSaleDTO) => keys.run(data, (key) => createSale(data, key)),

    async onSuccess() {
      // A sale consumes stock and generates a receivable: refresh sales, receivables, the dashboard and every stock screen.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sales }),
        queryClient.invalidateQueries({ queryKey: queryKeys.receivables }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        invalidateInventoryQueries(queryClient),
      ]);
      notify.success(saleMessages.created);
    },

    // The page renders the error itself (field errors + alert); no toast here.
  });
}
