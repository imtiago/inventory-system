import { api } from '@/shared/services/api';
import { idempotencyConfig } from '@/shared/utils/idempotencyKey';
import { FINANCE_KINDS, type FinanceKind } from '../config';
import type { IFinanceDetail, IFinanceFilters, IFinanceListResponse, ILateFeeQuote, IRegisterPaymentInput } from '../types';

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

export async function registerPayment(kind: FinanceKind, documentId: string, parcelId: string, input: IRegisterPaymentInput, idempotencyKey: string): Promise<IFinanceDetail> {
  const response = await api.post<{ data: IFinanceDetail }>(`${FINANCE_KINDS[kind].basePath}/${documentId}/parcels/${parcelId}/payments`, input, idempotencyConfig(idempotencyKey));

  return response.data.data;
}

export async function reversePayment(kind: FinanceKind, paymentId: string, reason: string, idempotencyKey: string): Promise<IFinanceDetail> {
  const response = await api.post<{ data: IFinanceDetail }>(`${FINANCE_KINDS[kind].basePath}/payments/${paymentId}/reverse`, { reason }, idempotencyConfig(idempotencyKey));

  return response.data.data;
}

/** Multa e juros de uma parcela a receber se paga em `paymentDate` (prévia; o pagamento recalcula). */
export async function getLateFeeQuote(documentId: string, parcelId: string, paymentDate: string): Promise<ILateFeeQuote> {
  const response = await api.get<{ data: ILateFeeQuote }>(`/receivables/${documentId}/parcels/${parcelId}/late-fees`, { params: { paymentDate } });

  return response.data.data;
}
