import { AxiosError } from 'axios';

import { api } from '@/shared/services/api';
import { idempotencyConfig } from '@/shared/utils/idempotencyKey';

import type { ApproveLimitRequestInput, CreateLimitRequestInput, CreditLimitRequest, CreditLimitRequestsResponse, CreditProfile, CreditRequestStatus, CreditProfileCode, CreditReviewItem, CreditSettings, CustomerCredit, StoreSettings, StoreSettingsInput, UpdateCreditProfileInput, UpdateCreditSettingsInput, UpdateCustomerCreditInput } from '../types';

export async function getCreditSettings(): Promise<CreditSettings> {
  const { data } = await api.get<{ data: CreditSettings }>('/credit/settings');

  return data.data;
}

export async function updateCreditSettings(input: UpdateCreditSettingsInput): Promise<CreditSettings> {
  const { data } = await api.put<{ data: CreditSettings }>('/credit/settings', input);

  return data.data;
}

export async function listCreditProfiles(): Promise<CreditProfile[]> {
  const { data } = await api.get<{ data: CreditProfile[] }>('/credit/profiles');

  return data.data;
}

export async function updateCreditProfile(code: CreditProfileCode, input: UpdateCreditProfileInput): Promise<CreditProfile> {
  const { data } = await api.put<{ data: CreditProfile }>(`/credit/profiles/${code}`, input);

  return data.data;
}

export async function getCustomerCredit(customerId: string): Promise<CustomerCredit> {
  const { data } = await api.get<{ data: CustomerCredit }>(`/customers/${customerId}/credit`);

  return data.data;
}

export async function updateCustomerCredit(customerId: string, input: UpdateCustomerCreditInput): Promise<CustomerCredit> {
  const { data } = await api.put<{ data: CustomerCredit }>(`/customers/${customerId}/credit`, input);

  return data.data;
}

export async function createLimitRequest(input: CreateLimitRequestInput, idempotencyKey: string): Promise<CreditLimitRequest> {
  const { data } = await api.post<{ data: CreditLimitRequest }>('/credit/limit-requests', input, idempotencyConfig(idempotencyKey));

  return data.data;
}

export async function listLimitRequests(params: { page: number; limit: number; status: CreditRequestStatus }): Promise<CreditLimitRequestsResponse> {
  const { data } = await api.get<CreditLimitRequestsResponse>('/credit/limit-requests', { params });

  return data;
}

export async function getLimitRequestCount(): Promise<number> {
  const { data } = await api.get<{ data: { pending: number } }>('/credit/limit-requests/count');

  return data.data.pending;
}

export async function approveLimitRequest({ id, ...body }: ApproveLimitRequestInput, idempotencyKey: string): Promise<CreditLimitRequest> {
  const { data } = await api.post<{ data: CreditLimitRequest }>(`/credit/limit-requests/${id}/approve`, body, idempotencyConfig(idempotencyKey));

  return data.data;
}

export async function rejectLimitRequest(id: string, reason: string): Promise<CreditLimitRequest> {
  const { data } = await api.post<{ data: CreditLimitRequest }>(`/credit/limit-requests/${id}/reject`, { reason });

  return data.data;
}

export async function getCreditReviewPreview(): Promise<CreditReviewItem[]> {
  const { data } = await api.get<{ data: CreditReviewItem[] }>('/credit/review/preview');

  return data.data;
}

export async function applyCreditReview(customerIds: string[], idempotencyKey: string): Promise<CreditReviewItem[]> {
  const { data } = await api.post<{ data: CreditReviewItem[] }>('/credit/review/apply', { customerIds }, idempotencyConfig(idempotencyKey));

  return data.data;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const { data } = await api.get<{ data: StoreSettings }>('/settings/store');

  return data.data;
}

export async function saveStoreSettings(input: StoreSettingsInput): Promise<StoreSettings> {
  const { data } = await api.put<{ data: StoreSettings }>('/settings/store', input);

  return data.data;
}

/** Baixa um PDF (carnê, recibo) como Blob; o erro volta com o corpo já lido (parseApiError acha a mensagem). */
export async function fetchPdf(url: string): Promise<Blob> {
  try {
    const { data } = await api.get<Blob>(url, { responseType: 'blob' });

    return new Blob([data], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* não é JSON: parseApiError usa a mensagem genérica */
      }
    }
    throw error;
  }
}
