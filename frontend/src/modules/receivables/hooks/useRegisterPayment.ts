import { useMutation, useQueryClient } from '@tanstack/react-query';

import { registerPayment } from '../services/receivableService';
import type { IRegisterPaymentInput } from '../types';
import { applyReceivableUpdate, refreshReceivable } from './receivableCache';

export function useRegisterPayment(receivableId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ parcelId, input }: { parcelId: string; input: IRegisterPaymentInput }) => registerPayment(receivableId, parcelId, input),
    onSuccess: (detail) => applyReceivableUpdate(queryClient, detail),
    onError: () => refreshReceivable(queryClient, receivableId),
  });
}
