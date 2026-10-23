import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { invalidateInventoryQueries } from '@/modules/inventory/utils/invalidateInventoryQueries';
import { notify } from '@/shared/utils/notify';
import { confirmNfeImport, discardNfeImport, getNfeImport, getNfeImports, uploadNfeXml } from '../services/nfeImportService';
import type { IConfirmNfeDTO, NfeImportStatus } from '../types';

export function useNfeImports(page: number, status?: NfeImportStatus) {
  return useQuery({
    queryKey: [...queryKeys.nfeImports, 'list', page, status ?? ''],
    queryFn: () => getNfeImports(page, status),
    placeholderData: (previousData) => previousData,
  });
}

export function useNfeImport(id: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.nfeImports, 'detail', id ?? ''],
    queryFn: () => getNfeImport(id as string),
    enabled: Boolean(id),
  });
}

// The pages render upload/confirm errors themselves (no toast).
export function useUploadNfeImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadNfeXml,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.nfeImports }),
  });
}

export function useDiscardNfeImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: discardNfeImport,
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: queryKeys.nfeImports });
      notify.success('Rascunho descartado.');
    },
    // The list renders the error itself.
  });
}

export function useConfirmNfeImport(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IConfirmNfeDTO) => confirmNfeImport(id, data),
    async onSuccess() {
      await Promise.all([
        ...[queryKeys.nfeImports, queryKeys.purchases, queryKeys.payables, queryKeys.suppliers, queryKeys.products, queryKeys.brands, queryKeys.categories].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
        invalidateInventoryQueries(queryClient),
      ]);
      notify.success('Nota importada e pedido de compra registrado.');
    },
  });
}
