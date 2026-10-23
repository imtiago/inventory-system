import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import type { FinanceKind } from '../config';
import { registerPayment } from '../services/financeService';
import type { IRegisterPaymentInput } from '../types';
import { applyFinanceUpdate, refreshFinanceDocument } from './financeCache';

export function useRegisterPayment(kind: FinanceKind, documentId: string) {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: (variables: { parcelId: string; input: IRegisterPaymentInput }) =>
      keys.run(variables, (key) => registerPayment(kind, documentId, variables.parcelId, variables.input, key)),
    onSuccess: (detail) => applyFinanceUpdate(queryClient, kind, detail),
    onError: () => refreshFinanceDocument(queryClient, kind, documentId),
  });
}
