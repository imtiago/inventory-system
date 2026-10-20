import { queryKeys } from '@/shared/react-query/keys';
import { createCustomer } from '../services/customerService';
import { useCrudMutation } from '@/shared/react-query/useCrudMutation.ts';
import { customerMessages } from '../config/messages';

export function useCreateCustomer() {
  return useCrudMutation({
    mutationFn: createCustomer,

    invalidateKeys: [queryKeys.customers],

    successMessage: customerMessages.created,

    errorMessage: 'Erro ao cadastrar Cliente.',
  });
}
