import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import type { FinanceKind } from '../config';
import { reversePayment } from '../services/financeService';
import { applyFinanceUpdate, refreshFinanceDocument } from './financeCache';

export function useReversePayment(kind: FinanceKind, documentId: string) {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: (variables: { paymentId: string; reason: string }) =>
      keys.run(variables, (key) => reversePayment(kind, variables.paymentId, variables.reason, key)),
    onSuccess: (detail) => applyFinanceUpdate(queryClient, kind, detail),
    onError: () => refreshFinanceDocument(queryClient, kind, documentId),
  });
}
