import { api } from '@/shared/services/api';
import { FINANCE_KINDS, type FinanceKind } from '../config';
import type { IFinanceDetail, IFinanceFilters, IFinanceListResponse, IRegisterPaymentInput } from '../types';

const PAGE_SIZE = 10;

export async function getFinanceList(kind: FinanceKind, page: number, filters: IFinanceFilters): Promise<IFinanceListResponse> {
  const params: Record<string, string | number> = { page, limit: PAGE_SIZE };

  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }

  const response = await api.get<IFinanceListResponse>(FINANCE_KINDS[kind].basePath, { params });

  return response.data;
}

export async function getFinanceDocument(kind: FinanceKind, id: string): Promise<IFinanceDetail> {
  const response = await api.get<{ data: IFinanceDetail }>(`${FINANCE_KINDS[kind].basePath}/${id}`);

  return response.data.data;
}

export async function registerPayment(kind: FinanceKind, documentId: string, parcelId: string, input: IRegisterPaymentInput): Promise<IFinanceDetail> {
  const response = await api.post<{ data: IFinanceDetail }>(`${FINANCE_KINDS[kind].basePath}/${documentId}/parcels/${parcelId}/payments`, input);

  return response.data.data;
}

export async function reversePayment(kind: FinanceKind, paymentId: string, reason: string): Promise<IFinanceDetail> {
  const response = await api.post<{ data: IFinanceDetail }>(`${FINANCE_KINDS[kind].basePath}/payments/${paymentId}/reverse`, { reason });

  return response.data.data;
}
