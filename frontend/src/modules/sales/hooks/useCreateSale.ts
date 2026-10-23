import { queryKeys } from '@/shared/react-query/keys';
import { useCrudMutation } from '@/shared/react-query/useCrudMutation.ts';
import { saleMessages } from '../config/messages';
import { createSale } from '../services/saleService';

export function useCreateSale() {
  return useCrudMutation({
    mutationFn: createSale,

    invalidateKeys: [queryKeys.sales],

    successMessage: saleMessages.created,

    errorMessage: 'Erro ao registrar a venda.',

    // The page renders the error itself (field errors + alert); avoid a duplicate toast.
    silentError: true,
  });
}
