import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { FinanceKind } from '../config';
import { reversePayment } from '../services/financeService';
import { applyFinanceUpdate, refreshFinanceDocument } from './financeCache';

export function useReversePayment(kind: FinanceKind, documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => reversePayment(kind, paymentId, reason),
    onSuccess: (detail) => applyFinanceUpdate(queryClient, kind, detail),
    onError: () => refreshFinanceDocument(queryClient, kind, documentId),
  });
}
