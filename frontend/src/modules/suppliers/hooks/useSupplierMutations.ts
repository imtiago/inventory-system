import { useCrudMutation } from '@/shared/react-query/useCrudMutation';
import { queryKeys } from '@/shared/react-query/keys';
import { createSupplier, deleteSupplier, updateSupplier } from '../services/supplierService';
import type { UpdateSupplierInput } from '../types';

// Purchases show the supplier name, so they are refreshed as well.
const invalidateKeys = [queryKeys.suppliers, queryKeys.purchases];

export function useCreateSupplier() {
  // SupplierForm displays errors itself.
  return useCrudMutation({ mutationFn: createSupplier, invalidateKeys, successMessage: 'Fornecedor cadastrado com sucesso.', silentError: true });
}

export function useUpdateSupplier(id: string) {
  return useCrudMutation({
    mutationFn: (payload: UpdateSupplierInput) => updateSupplier(id, payload),
    invalidateKeys,
    successMessage: 'Fornecedor atualizado com sucesso.',
    silentError: true,
  });
}

export function useDeleteSupplier() {
  // The list page displays the error (e.g. SUPPLIER_IN_USE) itself.
  return useCrudMutation({ mutationFn: deleteSupplier, invalidateKeys, successMessage: 'Fornecedor excluído.', silentError: true });
}
