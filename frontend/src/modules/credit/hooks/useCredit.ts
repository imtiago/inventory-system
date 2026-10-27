import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { useCrudMutation } from '@/shared/react-query/useCrudMutation';

import { getCreditSettings, getCustomerCredit, listCreditProfiles, updateCreditProfile, updateCreditSettings, updateCustomerCredit } from '../services/creditService';
import type { CreditProfileCode, UpdateCreditProfileInput, UpdateCreditSettingsInput, UpdateCustomerCreditInput } from '../types';

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
