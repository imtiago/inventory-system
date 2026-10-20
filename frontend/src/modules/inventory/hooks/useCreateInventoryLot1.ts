import { useCrudMutation } from '@/shared/react-query/useCrudMutation';
import { createInventoryLot } from '../services/inventoryService';

export function useCreateInventoryLot1() {
  return useCrudMutation({
    mutationFn: createInventoryLot,

    invalidateKeys: [],

    successMessage: 'Lot cadastrado com sucesso.',

    errorMessage: 'Erro ao cadastrar Lot.',
  });
}
