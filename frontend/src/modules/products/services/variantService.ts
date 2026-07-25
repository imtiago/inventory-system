// src/modules/products/services/variantService.ts

import { api } from "@/shared/services/api";

export interface Variant {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  productId: string;
}

export interface SaveVariantDTO {
  name: string;
  barcode?: string;
}

export async function getVariant(id: string): Promise<Variant> {
  const { data } = await api.get(`/variants/${id}`);

  return data.data ?? data;
}

export async function createVariant(
  productId: string,
  payload: SaveVariantDTO,
): Promise<Variant> {
  const { data } = await api.post(`/products/${productId}/variants`, payload);

  return data.data ?? data;
}

export async function updateVariant(
  id: string,
  payload: SaveVariantDTO,
): Promise<Variant> {
  const { data } = await api.put(`/variants/${id}`, payload);

  return data.data ?? data;
}

export async function deleteVariant(id: string): Promise<void> {
  await api.delete(`/variants/${id}`);
}
