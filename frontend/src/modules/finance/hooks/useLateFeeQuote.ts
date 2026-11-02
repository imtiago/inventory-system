import { useQuery } from '@tanstack/react-query';

import { getLateFeeQuote } from '../services/financeService';
import { financeRoot } from './financeKeys';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Prévia de multa e juros de uma parcela a receber na data do pagamento. */
export function useLateFeeQuote(documentId: string, parcelId: string, paymentDate: string, enabled: boolean) {
  return useQuery({
    queryKey: [...financeRoot('receivable'), 'late-fees', documentId, parcelId, paymentDate] as const,
    queryFn: () => getLateFeeQuote(documentId, parcelId, paymentDate),
    enabled: enabled && DATE_ONLY.test(paymentDate),
    staleTime: 30_000,
  });
}
