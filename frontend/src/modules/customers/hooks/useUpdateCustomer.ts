import { useCrudMutation } from '@/shared/react-query/useCrudMutation';

import { customerMessages } from '../config/messages';
import type { UpdateCustomerInput } from '../types';
import { updateCustomer } from '../services/customerService';
import { queryKeys } from '@/shared/react-query';

export function useUpdateCustomer(customerId: string) {
  return useCrudMutation({
    mutationFn: (payload: UpdateCustomerInput) => updateCustomer(customerId, payload),

    invalidateKeys: [queryKeys.customers],

    successMessage: customerMessages.updated,

    // CustomerForm displays errors itself.
    silentError: true,
  });
}
