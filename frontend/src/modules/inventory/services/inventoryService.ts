import { api } from '@/shared/services/api';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { idempotencyConfig } from '@/shared/utils/idempotencyKey';
import type { Inventory, InventoryBox, InventoryBoxWithStocks, InventoryLot, Paginated } from '../types';

/**
 * Inventory
 */

export async function getInventory(page = 1, limit = 10): Promise<Paginated<Inventory>> {
  const response = await api.get<Paginated<Inventory>>('/inventory', { params: { page, limit } });

  return response.data;
}

export async function getInventoryById(id: string): Promise<Inventory> {
  const response = await api.get<{ data: Inventory }>(`/inventory/${id}`);

  return response.data.data;
}

/** Returns null when the variant has no inventory yet (404 INVENTORY_NOT_FOUND). */
export async function getInventoryByVariant(variantId: string): Promise<Inventory | null> {
  try {
    const response = await api.get<{ data: Inventory }>(`/inventory/variants/${variantId}`);

    return response.data.data;
  } catch (error: unknown) {
    const parsed = parseApiErrorSync(error);

    if (parsed.status === 404 && parsed.code === 'INVENTORY_NOT_FOUND') {
      return null;
    }

    throw error;
  }
}

export interface InventoryBalance {
  productVariantId: string;
  quantity: number;
  reserved: number;
  available: number;
  /** Quantity in expired lots. */
  expired: number;
}

/** One request for many variants (max 100). Variants without an inventory row are simply absent. */
export async function getInventoryBalances(productVariantIds: string[]): Promise<InventoryBalance[]> {
  if (productVariantIds.length === 0) return [];

  const response = await api.get<{ data: InventoryBalance[] }>('/inventory', {
    params: { productVariantIds: productVariantIds.join(',') },
  });

  return response.data.data;
}

export async function createInventory(productVariantId: string): Promise<Inventory> {
  const response = await api.post<{ data: Inventory }>('/inventory', { productVariantId });

  return response.data.data;
}

/**
 * Inventory Lots
 */

export async function getInventoryLots(
  variantId: string,
  { page = 1, limit = 10 }: { page?: number; limit?: number } = {},
): Promise<Paginated<InventoryLot>> {
  const response = await api.get<Paginated<InventoryLot>>(`/inventory/variants/${variantId}/lots`, {
    params: { page, limit },
  });

  return response.data;
}

export interface CreateInventoryLotDTO {
  productVariantId: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  expirationDate: string | Date;
  manufacturingDate?: string | Date;
}

function toISO(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export async function createInventoryLot(dto: CreateInventoryLotDTO, idempotencyKey: string): Promise<InventoryLot> {
  const body = {
    ...dto,
    expirationDate: toISO(dto.expirationDate),
    manufacturingDate: dto.manufacturingDate ? toISO(dto.manufacturingDate) : undefined,
  };
  const response = await api.post<{ data: InventoryLot }>('/inventory/lots', body, idempotencyConfig(idempotencyKey));

  return response.data.data;
}

/**
 * Inventory Boxes
 */

export async function listInventoryBoxes(search?: string): Promise<Paginated<InventoryBox>> {
  const response = await api.get<Paginated<InventoryBox>>('/inventory/boxes', {
    params: search ? { search } : undefined,
  });

  return response.data;
}

/** Box with what is in it; each stock item carries `quantity` (this lot, this box). */
export async function getInventoryBoxByCode(code: string): Promise<InventoryBoxWithStocks> {
  const response = await api.get<{ data: InventoryBoxWithStocks }>(`/inventory/boxes/code/${encodeURIComponent(code)}`);

  return response.data.data;
}

export async function createInventoryBox(idempotencyKey: string): Promise<InventoryBox> {
  const response = await api.post<{ data: InventoryBox }>('/inventory/boxes', undefined, idempotencyConfig(idempotencyKey));

  return response.data.data;
}

export interface AddLotToBoxDTO {
  inventoryLotId: string;
  quantity: number;
}

export interface BoxItem {
  id: string;
  boxId: string;
  inventoryLotId: string;
  quantity: number;
}

export async function addLotToBox(boxId: string, data: AddLotToBoxDTO, idempotencyKey: string): Promise<BoxItem> {
  const response = await api.post<{ data: BoxItem }>(`/inventory/boxes/${boxId}/items`, data, idempotencyConfig(idempotencyKey));

  return response.data.data;
}
