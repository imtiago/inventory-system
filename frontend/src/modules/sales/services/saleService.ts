import { api } from '@/shared/services/api';
import { idempotencyConfig } from '@/shared/utils/idempotencyKey';
import type { ICreateSaleDTO, ICreditApprover, ISaleSimulation, ISaleSimulationRequest, ISaleCancelRequest, ISaleCancelRequestsResponse, ISaleFilters, ISaleDetail, ISalesResponse } from '../types';

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

/** Simulação (não grava nada): sem chave de idempotência. */
export async function simulateSale(data: ISaleSimulationRequest): Promise<ISaleSimulation> {
  const response = await api.post<{ data: ISaleSimulation }>('/sales/simulate', data);

  return response.data.data;
}

/** Quem pode autorizar exceção de crédito (seletor do modal de autorização). */
export async function listCreditApprovers(): Promise<ICreditApprover[]> {
  const response = await api.get<{ data: ICreditApprover[] }>('/credit/approvers');

  return response.data.data;
}

export async function getSale(id: string): Promise<ISaleDetail> {
  const response = await api.get<{ data: ISaleDetail }>(`/sales/${id}`);

  return response.data.data;
}

export async function requestSaleCancel(saleId: string, reason: string): Promise<ISaleCancelRequest> {
  const response = await api.post<{ data: ISaleCancelRequest }>(`/sales/${saleId}/cancel-requests`, { reason });

  return response.data.data;
}

export async function listSaleCancelRequests(params: { page: number; limit: number; status: ISaleCancelRequest['status'] }): Promise<ISaleCancelRequestsResponse> {
  const response = await api.get<ISaleCancelRequestsResponse>('/sales/cancel-requests', { params });

  return response.data;
}

export async function getSaleCancelRequestCount(): Promise<number> {
  const response = await api.get<{ data: { pending: number } }>('/sales/cancel-requests/count');

  return response.data.data.pending;
}

export async function approveSaleCancelRequest(id: string, idempotencyKey: string): Promise<ISaleCancelRequest> {
  const response = await api.post<{ data: ISaleCancelRequest }>(`/sales/cancel-requests/${id}/approve`, undefined, idempotencyConfig(idempotencyKey));

  return response.data.data;
}

export async function rejectSaleCancelRequest(id: string, reason: string): Promise<ISaleCancelRequest> {
  const response = await api.post<{ data: ISaleCancelRequest }>(`/sales/cancel-requests/${id}/reject`, { reason });

  return response.data.data;
}

export async function cancelSale(id: string, idempotencyKey: string): Promise<ISaleDetail> {
  const response = await api.post<{ data: ISaleDetail }>(`/sales/${id}/cancel`, undefined, idempotencyConfig(idempotencyKey));

  return response.data.data;
}
