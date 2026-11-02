import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { searchCustomers } from '@/modules/customers/services/customerService';
import { queryKeys } from '@/shared/react-query/keys';
import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import { notify } from '@/shared/utils/notify';

import {
  addLegacyRows,
  confirmLegacyBatch,
  createManualLegacyBatch,
  deleteLegacyBatch,
  getLegacyBatch,
  getLegacyBatches,
  revertLegacyBatch,
  updateLegacyRow,
  uploadLegacyCsv,
} from '../services/legacyImportService';
import type { AddLegacyRowsInput, LegacyBatch, LegacyLimitRule, UpdateLegacyRowInput } from '../types';

export function useLegacyBatches(page: number) {
  return useQuery({
    queryKey: [...queryKeys.legacyImports, 'list', page],
    queryFn: () => getLegacyBatches(page),
    placeholderData: (previousData) => previousData,
  });
}

export function useLegacyBatch(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.legacyImport(id ?? ''),
    queryFn: () => getLegacyBatch(id as string),
    enabled: Boolean(id),
  });
}

/** Grava o lote devolvido pelo servidor (a revisão inteira é recalculada a cada escrita) e marca a lista como velha. */
function storeBatch(queryClient: QueryClient, batch: LegacyBatch) {
  queryClient.setQueryData(queryKeys.legacyImport(batch.id), batch);

  return queryClient.invalidateQueries({ queryKey: [...queryKeys.legacyImports, 'list'] });
}

// As telas mostram os erros destas escritas (sem toast).
export function useUploadLegacyCsv() {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: uploadLegacyCsv, onSuccess: (batch) => storeBatch(queryClient, batch) });
}

/** Lote vazio do lançamento rápido. */
export function useCreateManualLegacyBatch() {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: createManualLegacyBatch, onSuccess: (batch) => storeBatch(queryClient, batch) });
}

export function useAddLegacyRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, input }: { batchId: string; input: AddLegacyRowsInput }) => addLegacyRows(batchId, input),
    onSuccess: (batch) => storeBatch(queryClient, batch),
  });
}

export function useUpdateLegacyRow(batchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rowId, input }: { rowId: string; input: UpdateLegacyRowInput }) => updateLegacyRow(batchId, rowId, input),
    onSuccess: (batch) => storeBatch(queryClient, batch),
  });
}

export function useDeleteLegacyBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLegacyBatch,
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: queryKeys.legacyImports });
      notify.success('Rascunho excluído.');
    },
  });
}

/** Confirmar/desfazer mexem em contas a receber, clientes (e a ficha de crédito, sob `customers`) e no dashboard. */
async function afterMoneyChange(queryClient: QueryClient, batch: LegacyBatch) {
  queryClient.setQueryData(queryKeys.legacyImport(batch.id), batch);
  const customerIds = [...new Set(batch.rows.map((row) => row.customerId).filter((id): id is string => Boolean(id)))];

  await Promise.all([
    ...[queryKeys.legacyImports, queryKeys.receivables, queryKeys.customers, queryKeys.dashboard].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ...customerIds.map((id) => queryClient.invalidateQueries({ queryKey: queryKeys.customerCredit(id) })),
  ]);
}

export function useConfirmLegacyBatch(id: string) {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: (limitRule: LegacyLimitRule) => keys.run({ id, limitRule }, (key) => confirmLegacyBatch(id, limitRule, key)),
    async onSuccess(batch) {
      await afterMoneyChange(queryClient, batch);
      notify.success('Lote confirmado. As dívidas antigas foram gravadas.');
    },
  });
}

export function useRevertLegacyBatch(id: string) {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: () => keys.run({ id }, (key) => revertLegacyBatch(id, key)),
    async onSuccess(batch) {
      await afterMoneyChange(queryClient, batch);
      notify.success('Lote desfeito. As dívidas foram canceladas.');
    },
  });
}

/** Opções para `EntitySearchSelect` (busca de clientes no servidor). */
export function useCustomerOptions(search: string) {
  const query = useQuery({
    queryKey: [...queryKeys.customers, 'search', search],
    queryFn: () => searchCustomers(search),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });

  return { data: query.data?.data, isFetching: query.isFetching, isError: query.isError };
}
