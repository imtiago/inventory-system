import { api } from '@/shared/services/api';

import type { CreditProfile, CreditProfileCode, CreditSettings, CustomerCredit, UpdateCreditProfileInput, UpdateCreditSettingsInput, UpdateCustomerCreditInput } from '../types';

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
