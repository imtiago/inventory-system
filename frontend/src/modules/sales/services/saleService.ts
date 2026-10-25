import { api } from '@/shared/services/api';
import { idempotencyConfig } from '@/shared/utils/idempotencyKey';
import type { ICreateSaleDTO, ISaleFilters, ISaleDetail, ISalesResponse } from '../types';

const PAGE_SIZE = 10;

export async function getSales(page = 1, filters: ISaleFilters = {}): Promise<ISalesResponse> {
  const response = await api.get('/sales', {
    params: {
      page,
      limit: PAGE_SIZE,
      from: filters.from || undefined,
      to: filters.to || undefined,
      status: filters.status || undefined,
    },
  });

  return response.data;
}

export async function createSale(data: ICreateSaleDTO, idempotencyKey: string): Promise<ISaleDetail> {
  const response = await api.post<{ data: ISaleDetail }>('/sales', data, idempotencyConfig(idempotencyKey));

  return response.data.data;
}

export async function getSale(id: string): Promise<ISaleDetail> {
  const response = await api.get<{ data: ISaleDetail }>(`/sales/${id}`);

  return response.data.data;
}

export async function cancelSale(id: string, idempotencyKey: string): Promise<ISaleDetail> {
  const response = await api.post<{ data: ISaleDetail }>(`/sales/${id}/cancel`, undefined, idempotencyConfig(idempotencyKey));

  return response.data.data;
}
