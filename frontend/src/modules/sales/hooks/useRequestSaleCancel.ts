import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { notify } from '@/shared/utils/notify';

import { requestSaleCancel } from '../services/saleService';

/** Vendedor pede o cancelamento. O erro da API fica para o modal mostrar. */
export function useRequestSaleCancel(saleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => requestSaleCancel(saleId, reason),

    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...queryKeys.sales, 'detail', saleId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cancelRequests }),
      ]);
      notify.success('Pedido de cancelamento enviado.');
    },
  });
}
