import { api } from '@/shared/services/api';
import type { IReceivableDetail, IReceivableFilters, IReceivablesResponse, IRegisterPaymentInput } from '../types';

const PAGE_SIZE = 10;

export async function getReceivables(page: number, filters: IReceivableFilters): Promise<IReceivablesResponse> {
  const params: Record<string, string | number> = { page, limit: PAGE_SIZE };

  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }

  const response = await api.get<IReceivablesResponse>('/receivables', { params });

  return response.data;
}

export async function getReceivable(id: string): Promise<IReceivableDetail> {
  const response = await api.get<{ data: IReceivableDetail }>(`/receivables/${id}`);

  return response.data.data;
}

export async function registerPayment(receivableId: string, parcelId: string, input: IRegisterPaymentInput): Promise<IReceivableDetail> {
  const response = await api.post<{ data: IReceivableDetail }>(`/receivables/${receivableId}/parcels/${parcelId}/payments`, input);

  return response.data.data;
}

export async function reversePayment(paymentId: string, reason: string): Promise<IReceivableDetail> {
  const response = await api.post<{ data: IReceivableDetail }>(`/receivables/payments/${paymentId}/reverse`, { reason });

  return response.data.data;
}
