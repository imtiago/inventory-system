import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { notify } from '@/shared/utils/notify';
import { invalidateInventoryQueries } from '@/modules/inventory/utils/invalidateInventoryQueries';
import { saleMessages } from '../config/messages';
import { createSale } from '../services/saleService';

export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSale,

    async onSuccess() {
      // A sale consumes stock: refresh sales and every stock screen.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sales }),
        invalidateInventoryQueries(queryClient),
      ]);
      notify.success(saleMessages.created);
    },

    // The page renders the error itself (field errors + alert); no toast here.
  });
}
