import { useCrudMutation } from '@/shared/react-query/useCrudMutation';

import { customerMessages } from '../config/messages';
import { updateCustomer } from '../services/customerService';
import { queryKeys } from '@/shared/react-query';

export function useUpdateCustomer(customerId: string) {
  return useCrudMutation({
    mutationFn: (payload) => updateCustomer(customerId, payload),

    invalidateKeys: [queryKeys.customers],

    successMessage: customerMessages.updated,

    errorMessage: 'Erro ao atualizar Cliente.',
  });
}
