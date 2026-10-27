import { api } from '@/shared/services/api';

import type { Paginated } from '@/shared/types/pagination';

import type { ApplyPriceSource, ApplyReviewsResult, PriceReview, PricingExpense, PricingSettings, SaveExpenseInput, SaveSettingsInput, TargetMarginLevel, VariantPricing } from '../types';

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

export async function getVariantPricing(variantId: string): Promise<VariantPricing> {
  const { data } = await api.get<{ data: VariantPricing }>(`/pricing/variants/${variantId}`);

  return data.data;
}

export async function applyVariantPrice(variantId: string, source: ApplyPriceSource): Promise<VariantPricing> {
  const { data } = await api.post<{ data: VariantPricing }>(`/pricing/variants/${variantId}/apply-price`, { source });

  return data.data;
}

/** `price` null remove o preço da revista. */
export async function setSupplierPrice(variantId: string, price: number | null): Promise<VariantPricing> {
  const { data } = await api.put<{ data: VariantPricing }>(`/pricing/variants/${variantId}/supplier-price`, { supplierSuggestedPrice: price });

  return data.data;
}

export async function listPriceReviews(params: { page: number; limit: number }): Promise<Paginated<PriceReview>> {
  const { data } = await api.get<Paginated<PriceReview>>('/pricing/reviews', { params: { status: 'PENDING', ...params } });

  return data;
}

export async function getPriceReviewCount(): Promise<number> {
  const { data } = await api.get<{ data: { pending: number } }>('/pricing/reviews/count');

  return data.data.pending;
}

export async function applyPriceReviews(ids: string[]): Promise<ApplyReviewsResult> {
  const { data } = await api.post<{ data: ApplyReviewsResult }>('/pricing/reviews/apply', { ids });

  return data.data;
}

export async function dismissPriceReview(id: string): Promise<void> {
  await api.post(`/pricing/reviews/${id}/dismiss`);
}
