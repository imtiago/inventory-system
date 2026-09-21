import { api } from '@/shared/services/api';

/**
 * =========================
 * Inventory
 * =========================
 */

export async function getVariantInventory(productVariantId: string) {
  const response = await api.get(`/inventory/variant/${productVariantId}`);

  return response.data.data;
}

/**
 * =========================
 * Inventory Lots
 * =========================
 */

export interface CreateInventoryLotDTO {
  productVariantId: string;
  batchNumber: string;
  manufacturingDate?: string;
  expirationDate: string;
  quantity: number;
}

export async function createInventoryLot(data: CreateInventoryLotDTO) {
  const response = await api.post('/inventory/lots', data);

  return response.data.data;
}

/**
 * =========================
 * Inventory Boxes
 * =========================
 */

export interface CreateInventoryBoxDTO {
  code: string;
}

export async function createInventoryBox(data: CreateInventoryBoxDTO) {
  const response = await api.post('/inventory/boxes', data);

  return response.data.data;
}

/**
 * =========================
 * Add Lot to Box
 * =========================
 */

export interface AddLotToBoxDTO {
  inventoryLotId: string;
  quantity: number;
}

export async function addLotToBox(boxId: string, data: AddLotToBoxDTO) {
  const response = await api.post(`/inventory/boxes/${boxId}/items`, data);

  return response.data.data;
}
