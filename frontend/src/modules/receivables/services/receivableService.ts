import { api } from '@/shared/services/api';
import type { IReceivableFilters, IReceivablesResponse } from '../types';

const PAGE_SIZE = 10;

export async function getReceivables(page: number, filters: IReceivableFilters): Promise<IReceivablesResponse> {
  const params: Record<string, string | number> = { page, limit: PAGE_SIZE };

  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }

  const response = await api.get<IReceivablesResponse>('/receivables', { params });

  return response.data;
}
