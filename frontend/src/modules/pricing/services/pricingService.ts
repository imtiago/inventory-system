import { api } from '@/shared/services/api';

import type { PricingExpense, PricingSettings, SaveExpenseInput, SaveSettingsInput, TargetMarginLevel } from '../types';

export async function getPricingSettings(): Promise<PricingSettings> {
  const { data } = await api.get<{ data: PricingSettings }>('/pricing/settings');

  return data.data;
}

export async function savePricingSettings(input: SaveSettingsInput): Promise<PricingSettings> {
  const { data } = await api.put<{ data: PricingSettings }>('/pricing/settings', input);

  return data.data;
}

export async function createExpense(input: SaveExpenseInput): Promise<PricingExpense> {
  const { data } = await api.post<{ data: PricingExpense }>('/pricing/expenses', input);

  return data.data;
}

export async function updateExpense(id: string, input: SaveExpenseInput): Promise<PricingExpense> {
  const { data } = await api.put<{ data: PricingExpense }>(`/pricing/expenses/${id}`, input);

  return data.data;
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/pricing/expenses/${id}`);
}

/** `percent` null remove a margem do nível (volta a valer a do nível acima). */
export async function setTargetMargin(level: TargetMarginLevel, id: string, percent: number | null): Promise<void> {
  await api.put(`/pricing/target-margins/${level}/${id}`, { targetMarginPercent: percent });
}
