// Single source of truth for inventory types (matches backend DTOs / contract fixtures).

import type { Paginated } from "@/shared/types/pagination";

export type { Paginated };

export interface InventoryProductVariant {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  productId: string;
}

export interface Inventory {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  /** Quantity in expired lots. */
  expired: number;
  minimumStock: number;
  averageCost: number;
  createdAt: string;
  productVariant: InventoryProductVariant;
}

export interface InventoryLot {
  id: string;
  inventoryId: string;
  productVariantId: string;
  batchNumber: string | null;
  initialQuantity: number;
  remainingQuantity: number;
  allocatedQuantity: number;
  unitCost: number;
  sourceType: string;
  manufacturingDate: string | null;
  expirationDate: string | null;
  createdAt: string;
}

export interface InventoryBox {
  id: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

/** Item de uma caixa: quanto de um lote há NESTA caixa (o lote traz o total). */
export interface InventoryBoxStockItem {
  id?: string;
  boxId: string;
  quantity: number;
  inventoryLot: InventoryLot;
}

export interface InventoryBoxWithStocks extends InventoryBox {
  stocks: InventoryBoxStockItem[];
}

// Legacy aliases kept for existing callers.
export type IInventoryProductVariant = InventoryProductVariant;
export type IInventory = Inventory;
export type IInventoryListResponse = Paginated<Inventory>;
export type InventoryLotListResponse = Paginated<InventoryLot>;

export interface Product {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  brandId: string;
  categoryId: string;
  createdAt?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  productId: string;
  salePrice?: number;
  createdAt?: string;
}
