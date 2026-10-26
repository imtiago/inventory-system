import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { invalidateInventoryQueries } from '@/modules/inventory/utils/invalidateInventoryQueries';
import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import { notify } from '@/shared/utils/notify';
import { confirmNfeImport, discardNfeImport, getNfeImport, getNfeImports, revertNfeImport, uploadNfeXml } from '../services/nfeImportService';
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
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: (data: IConfirmNfeDTO) => keys.run(data, (key) => confirmNfeImport(id, data, key)),
    async onSuccess() {
      await Promise.all([
        ...[queryKeys.nfeImports, queryKeys.purchases, queryKeys.payables, queryKeys.dashboard, queryKeys.suppliers, queryKeys.products, queryKeys.brands, queryKeys.categories].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
        invalidateInventoryQueries(queryClient),
      ]);
      notify.success('Nota importada e pedido de compra registrado.');
    },
  });
}

/** Undoes the import: stock leaves, the payable and the order are canceled. The page renders the block reason itself. */
export function useRevertNfeImport(id: string) {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: () => keys.run(id, (key) => revertNfeImport(id, key)),
    async onSuccess(note) {
      queryClient.setQueryData([...queryKeys.nfeImports, 'detail', id], note);
      await Promise.all([
        ...[queryKeys.nfeImports, queryKeys.purchases, queryKeys.payables, queryKeys.dashboard].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        invalidateInventoryQueries(queryClient),
      ]);
      notify.success('Importação desfeita.');
    },
  });
}
