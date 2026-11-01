import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useCan } from '@/shared/auth/useCan';
import { queryKeys } from '@/shared/react-query/keys';
import { useCrudMutation } from '@/shared/react-query/useCrudMutation';

import {
  applyCreditReview,
  approveLimitRequest,
  createLimitRequest,
  getCreditReviewPreview,
  getCreditSettings,
  getCustomerCredit,
  getLimitRequestCount,
  listCreditProfiles,
  listLimitRequests,
  rejectLimitRequest,
  updateCreditProfile,
  updateCreditSettings,
  updateCustomerCredit,
} from '../services/creditService';
import type { ApproveLimitRequestInput, CreateLimitRequestInput, CreditProfileCode, CreditRequestStatus, UpdateCreditProfileInput, UpdateCreditSettingsInput, UpdateCustomerCreditInput } from '../types';

export function useCreditSettings() {
  return useQuery({ queryKey: queryKeys.creditSettings, queryFn: getCreditSettings });
}

export function useCreditProfiles() {
  return useQuery({ queryKey: queryKeys.creditProfiles, queryFn: listCreditProfiles });
}

export function useCustomerCredit(customerId: string) {
  return useQuery({ queryKey: queryKeys.customerCredit(customerId), queryFn: () => getCustomerCredit(customerId), enabled: Boolean(customerId) });
}

export function useSaveCreditSettings() {
  return useCrudMutation({
    mutationFn: (input: UpdateCreditSettingsInput) => updateCreditSettings(input),
    invalidateKeys: [queryKeys.creditSettings],
    silentError: true,
  });
}

export function useUpdateCreditProfile() {
  return useCrudMutation({
    mutationFn: ({ code, input }: { code: CreditProfileCode; input: UpdateCreditProfileInput }) => updateCreditProfile(code, input),
    invalidateKeys: [queryKeys.creditProfiles],
    successMessage: 'Perfil salvo.',
    silentError: true,
  });
}

// O ajuste mexe na ficha (e no histórico) do cliente.
export function useUpdateCustomerCredit(customerId: string) {
  return useCrudMutation({
    mutationFn: (input: UpdateCustomerCreditInput) => updateCustomerCredit(customerId, input),
    invalidateKeys: [queryKeys.customerCredit(customerId)],
    successMessage: 'Crédito atualizado.',
    silentError: true,
  });
}

export const CREDIT_REQUESTS_PAGE_SIZE = 20;

export function useCreditLimitRequests(page: number, status: CreditRequestStatus) {
  const params = { page, limit: CREDIT_REQUESTS_PAGE_SIZE, status };

  return useQuery({ queryKey: queryKeys.creditRequestList(params), queryFn: () => listLimitRequests(params), placeholderData: keepPreviousData });
}

/** Pendentes (menu). Só consulta quem tem `credit.approve`; sem a permissão a rota responderia 403. */
export function useCreditRequestCount() {
  const allowed = useCan('credit.approve');

  return useQuery({ queryKey: queryKeys.creditRequestCount, queryFn: getLimitRequestCount, enabled: allowed, staleTime: 30_000 });
}

// Pedido auto-aprovado já muda a ficha (limite e histórico); por isso invalida a ficha também.
export function useCreateLimitRequest() {
  return useCrudMutation({
    mutationFn: (input: CreateLimitRequestInput, key) => createLimitRequest(input, key),
    idempotent: true,
    invalidateKeys: [queryKeys.creditRequests, queryKeys.customers],
    silentError: true,
  });
}

// Aprovar muda o limite do cliente: ficha e histórico mudam junto.
export function useApproveLimitRequest() {
  return useCrudMutation({
    mutationFn: (input: ApproveLimitRequestInput, key) => approveLimitRequest(input, key),
    idempotent: true,
    invalidateKeys: [queryKeys.creditRequests, queryKeys.customers],
    successMessage: 'Pedido aprovado: limite atualizado.',
    silentError: true,
  });
}

export function useRejectLimitRequest() {
  return useCrudMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectLimitRequest(id, reason),
    invalidateKeys: [queryKeys.creditRequests],
    successMessage: 'Pedido recusado.',
    silentError: true,
  });
}

/** Prévia da revisão: sempre recalculada (nunca em cache), pois depende do dia e dos pagamentos. */
export function useCreditReviewPreview() {
  return useQuery({ queryKey: queryKeys.creditReviewPreview, queryFn: getCreditReviewPreview, staleTime: 0, gcTime: 0 });
}

// Aplicar muda perfil/limite/situação das fichas e o histórico de cada cliente.
export function useApplyCreditReview() {
  return useCrudMutation({
    mutationFn: (customerIds: string[], key) => applyCreditReview(customerIds, key),
    idempotent: true,
    invalidateKeys: [queryKeys.creditReviewPreview, queryKeys.customers],
    silentError: true,
  });
}
