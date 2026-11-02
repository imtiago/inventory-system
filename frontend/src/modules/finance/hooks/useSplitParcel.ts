import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import { splitParcel, type ISplitParcelInput } from '../services/financeService';
import { applyFinanceUpdate, refreshFinanceDocument } from './financeCache';

export function useSplitParcel(documentId: string) {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: (variables: { parcelId: string; input: ISplitParcelInput }) => keys.run(variables, (key) => splitParcel(documentId, variables.parcelId, variables.input, key)),
    onSuccess: async (detail) => {
      await Promise.all([
        applyFinanceUpdate(queryClient, 'receivable', detail),
        // Prazos e parcelas mudam a exposição e a situação de atraso da ficha de crédito.
        detail.customer ? queryClient.invalidateQueries({ queryKey: queryKeys.customerCredit(detail.customer.id) }) : Promise.resolve(),
      ]);
    },
    onError: () => refreshFinanceDocument(queryClient, 'receivable', documentId),
  });
}
