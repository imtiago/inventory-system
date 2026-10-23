import { api } from '@/shared/services/api';
import type { ICreatePurchaseDTO, IPurchaseDetail, IPurchaseFilters, IReceivePurchaseDTO, PurchaseListResponse } from '../types';

const PAGE_SIZE = 10;

export async function getPurchases(page: number, filters: IPurchaseFilters): Promise<PurchaseListResponse> {
  const params: Record<string, string | number> = { page, limit: PAGE_SIZE };

  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }

  const response = await api.get<PurchaseListResponse>('/purchases', { params });

  return response.data;
}

export async function getPurchase(id: string): Promise<IPurchaseDetail> {
  const response = await api.get<{ data: IPurchaseDetail }>(`/purchases/${id}`);

  return response.data.data;
}

export async function createPurchase(data: ICreatePurchaseDTO): Promise<IPurchaseDetail> {
  const response = await api.post<{ data: IPurchaseDetail }>('/purchases', data);

  return response.data.data;
}

export async function receivePurchase(id: string, data: IReceivePurchaseDTO): Promise<IPurchaseDetail> {
  const response = await api.post<{ data: IPurchaseDetail }>(`/purchases/${id}/receipts`, data);

  return response.data.data;
}

export async function cancelPurchase(id: string, reason: string): Promise<IPurchaseDetail> {
  const response = await api.post<{ data: IPurchaseDetail }>(`/purchases/${id}/cancel`, { reason });

  return response.data.data;
}
