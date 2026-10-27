// src/modules/products/services/variantService.ts

import { api } from "@/shared/services/api";

import type { ProductVariant } from "../types";

export type Variant = ProductVariant;

export interface SaveVariantDTO {
  name: string;
  barcode?: string | null;
  salePrice?: number;
  /** Só do formulário: não vai no corpo (a margem usa a rota de margens). */
  targetMarginBps?: number | null;
}

export async function getVariant(id: string): Promise<Variant> {
  const { data } = await api.get(`/variants/${id}`);

  return data.data ?? data;
}

export async function createVariant(
  productId: string,
  payload: SaveVariantDTO,
): Promise<Variant> {
  const body = { ...payload };
  delete body.targetMarginBps;
  const { data } = await api.post(`/products/${productId}/variants`, body);

  return data.data ?? data;
}

export async function updateVariant(
  id: string,
  payload: Partial<SaveVariantDTO>,
): Promise<Variant> {
  const { data } = await api.put(`/variants/${id}`, payload);

  return data.data ?? data;
}

export async function deleteVariant(id: string): Promise<void> {
  await api.delete(`/variants/${id}`);
}
