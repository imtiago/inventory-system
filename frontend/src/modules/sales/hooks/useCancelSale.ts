import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { notify } from '@/shared/utils/notify';
import { saleMessages } from '../config/messages';
import { cancelSale } from '../services/saleService';

export function useCancelSale(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cancelSale(id),

    async onSuccess(sale) {
      queryClient.setQueryData([...queryKeys.sales, 'detail', id], sale);
      // Refresh lists only; the detail was just set from the response.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.sales,
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
      notify.success(saleMessages.canceled);
    },
    // The page renders the backend message itself.
  });
}
