import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import { notify } from '@/shared/utils/notify';
import { invalidateInventoryQueries } from '@/modules/inventory/utils/invalidateInventoryQueries';

import { approveSaleCancelRequest, rejectSaleCancelRequest } from '../services/saleService';

/** Aprovar cancela a venda: devolve estoque e cancela a conta a receber. */
export function useApproveSaleCancelRequest() {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: (id: string) => keys.run(id, (key) => approveSaleCancelRequest(id, key)),

    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.cancelRequests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sales }),
        queryClient.invalidateQueries({ queryKey: queryKeys.receivables }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        invalidateInventoryQueries(queryClient),
      ]);
      notify.success('Pedido aprovado: venda cancelada.');
    },
    // A página mostra a mensagem da API no diálogo.
  });
}

/** Recusar não mexe na venda; só o pedido (e o detalhe da venda, que deixa de ter pendência). */
export function useRejectSaleCancelRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectSaleCancelRequest(id, reason),

    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.cancelRequests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sales }),
      ]);
      notify.success('Pedido recusado.');
    },
  });
}
