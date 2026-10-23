import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { FinanceKind } from '../config';
import { registerPayment } from '../services/financeService';
import type { IRegisterPaymentInput } from '../types';
import { applyFinanceUpdate, refreshFinanceDocument } from './financeCache';

export function useRegisterPayment(kind: FinanceKind, documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ parcelId, input }: { parcelId: string; input: IRegisterPaymentInput }) => registerPayment(kind, documentId, parcelId, input),
    onSuccess: (detail) => applyFinanceUpdate(queryClient, kind, detail),
    onError: () => refreshFinanceDocument(queryClient, kind, documentId),
  });
}
