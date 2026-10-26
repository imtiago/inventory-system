import { idempotencyConfig } from '@/shared/utils/idempotencyKey';
import { api } from '@/shared/services/api';
import type { IConfirmNfeDTO, IConfirmNfeResult, INfeImport, NfeImportListResponse, NfeImportStatus } from '../types';

const PAGE_SIZE = 10;

export async function getNfeImports(page: number, status?: NfeImportStatus): Promise<NfeImportListResponse> {
  const response = await api.get<NfeImportListResponse>('/nfe-imports', { params: { page, limit: PAGE_SIZE, ...(status ? { status } : {}) } });

  return response.data;
}

export async function getNfeImport(id: string): Promise<INfeImport> {
  const response = await api.get<{ data: INfeImport }>(`/nfe-imports/${id}`);

  return response.data.data;
}

/** Multipart upload (field "file"). 201 creates the draft, 200 replaces the draft of the same access key. */
export async function uploadNfeXml(file: File): Promise<INfeImport> {
  const form = new FormData();
  form.append('file', file);

  const response = await api.post<{ data: INfeImport }>('/nfe-imports', form);

  return response.data.data;
}

export async function discardNfeImport(id: string): Promise<void> {
  await api.delete(`/nfe-imports/${id}`);
}

export async function confirmNfeImport(id: string, data: IConfirmNfeDTO, idempotencyKey: string): Promise<IConfirmNfeResult> {
  const response = await api.post<{ data: IConfirmNfeResult }>(`/nfe-imports/${id}/confirm`, data, idempotencyConfig(idempotencyKey));

  return response.data.data;
}

/** Undoes a received import (ADMIN). 409 NFE_REVERT_BLOCKED carries the reason in `message`. */
export async function revertNfeImport(id: string, idempotencyKey: string): Promise<INfeImport> {
  const response = await api.post<{ data: INfeImport }>(`/nfe-imports/${id}/revert`, undefined, idempotencyConfig(idempotencyKey));

  return response.data.data;
}
