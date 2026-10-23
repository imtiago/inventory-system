import { api } from '@/shared/services/api';
import { idempotencyConfig } from '@/shared/utils/idempotencyKey';
import type { ICreateSaleDTO, ISaleDetail, ISalesResponse } from '../types';

const PAGE_SIZE = 10;

export async function getSales(page = 1): Promise<ISalesResponse> {
  const response = await api.get('/sales', {
    params: {
      page,
      limit: PAGE_SIZE,
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
