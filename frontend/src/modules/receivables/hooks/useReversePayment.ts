import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reversePayment } from '../services/receivableService';
import { applyReceivableUpdate, refreshReceivable } from './receivableCache';

export function useReversePayment(receivableId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => reversePayment(paymentId, reason),
    onSuccess: (detail) => applyReceivableUpdate(queryClient, detail),
    onError: () => refreshReceivable(queryClient, receivableId),
  });
}
