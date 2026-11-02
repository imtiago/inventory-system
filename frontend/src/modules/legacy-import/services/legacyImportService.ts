import { api } from '@/shared/services/api';
import { downloadFile } from '@/shared/utils/download';
import { idempotencyConfig } from '@/shared/utils/idempotencyKey';

import type { AddLegacyRowsInput, LegacyBatch, LegacyBatchListResponse, LegacyLimitRule, LegacyRevertResult, UpdateLegacyRowInput } from '../types';

const PAGE_SIZE = 10;

export async function getLegacyBatches(page: number): Promise<LegacyBatchListResponse> {
  const response = await api.get<LegacyBatchListResponse>('/legacy-imports', { params: { page, limit: PAGE_SIZE } });

  return response.data;
}

export async function getLegacyBatch(id: string): Promise<LegacyBatch> {
  const response = await api.get<{ data: LegacyBatch }>(`/legacy-imports/${id}`);

  return response.data.data;
}

/** Modelo CSV (BOM, `;`); o helper adia a revogação do link para o Safari do iPhone. */
export function downloadLegacyTemplate(): Promise<void> {
  return downloadFile('/legacy-imports/template.csv', {}, 'modelo-caderninho.csv');
}

/** Multipart (campo "file"): cria um lote rascunho com as linhas da planilha. */
export async function uploadLegacyCsv(file: File): Promise<LegacyBatch> {
  const form = new FormData();
  form.append('file', file);

  const response = await api.post<{ data: LegacyBatch }>('/legacy-imports/csv', form);

  return response.data.data;
}

export async function createManualLegacyBatch(): Promise<LegacyBatch> {
  const response = await api.post<{ data: LegacyBatch }>('/legacy-imports', { source: 'MANUAL' });

  return response.data.data;
}

export async function addLegacyRows(batchId: string, input: AddLegacyRowsInput): Promise<LegacyBatch> {
  const response = await api.post<{ data: LegacyBatch }>(`/legacy-imports/${batchId}/rows`, input);

  return response.data.data;
}

export async function updateLegacyRow(batchId: string, rowId: string, input: UpdateLegacyRowInput): Promise<LegacyBatch> {
  const response = await api.patch<{ data: LegacyBatch }>(`/legacy-imports/${batchId}/rows/${rowId}`, input);

  return response.data.data;
}

export async function deleteLegacyBatch(id: string): Promise<void> {
  await api.delete(`/legacy-imports/${id}`);
}

export async function confirmLegacyBatch(id: string, limitRule: LegacyLimitRule, idempotencyKey: string): Promise<LegacyBatch> {
  const response = await api.post<{ data: LegacyBatch }>(`/legacy-imports/${id}/confirm`, { limitRule }, idempotencyConfig(idempotencyKey));

  return response.data.data;
}

export async function revertLegacyBatch(id: string, idempotencyKey: string): Promise<LegacyRevertResult> {
  const response = await api.post<{ data: LegacyRevertResult }>(`/legacy-imports/${id}/revert`, undefined, idempotencyConfig(idempotencyKey));

  return response.data.data;
}
