import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { notify } from '@/shared/utils/notify';
import { invalidateInventoryQueries } from '@/modules/inventory/utils/invalidateInventoryQueries';
import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import { saleMessages } from '../config/messages';
import type { ICreateSaleDTO } from '../types';
import { createSale } from '../services/saleService';

/** Dados que identificam a tentativa: a senha do aprovador não entra (nem fica guardada no rastreador). */
function attemptOf(data: ICreateSaleDTO): unknown {
  const override = data.payment.override;
  if (!override) return data;

  return { ...data, payment: { ...data.payment, override: { approverEmail: override.approverEmail, reason: override.reason } } };
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    // Mesma chave enquanto carrinho/condição não mudam (novas tentativas após erro).
    mutationFn: (data: ICreateSaleDTO) => keys.run(attemptOf(data), (key) => createSale(data, key)),

    async onSuccess(_sale, data) {
      // A sale consumes stock, generates a receivable and (crediário) uses the customer's credit:
      // refresh sales, receivables, the dashboard, every stock screen and the customer's credit file.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sales }),
        queryClient.invalidateQueries({ queryKey: queryKeys.receivables }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customerCredit(data.customerId) }),
        invalidateInventoryQueries(queryClient),
      ]);
      notify.success(saleMessages.created);
    },

    // The page renders the error itself (field errors + alert); no toast here.
  });
}
