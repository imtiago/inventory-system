import { api } from "@/shared/services/api";

export interface VariantInventory {
  id: string;
  productVariantId: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  minimumStock: number;
}

export async function getVariantInventory(
  variantId: string,
): Promise<VariantInventory> {
  const { data } = await api.get(`/inventory/variants/${variantId}`);

  return data.data;
}
// export async function listMovements(
//   variantId: string,
// ): Promise<VariantInventory> {
//   const { data } = await api.get(`/inventory/variants/${variantId}`);

//   return data.data;
// }
// export async function getVariantInventory(
//   variantId: string,
// ): Promise<VariantInventory> {
//   const { data } = await api.get(`/inventory/variants/${variantId}`);

//   return data.data;
// }
