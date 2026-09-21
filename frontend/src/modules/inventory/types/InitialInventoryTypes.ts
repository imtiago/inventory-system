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
  createdAt?: string;
}

export interface InventoryLot {
  id: string;
  inventoryId: string;
  productVariantId: string;
  sourceType?: string;
  sourceId?: string | null;

  initialQuantity: number;
  remainingQuantity: number;
  unitCost?: number | string;

  batchNumber: string | null;
  manufacturingDate: string | null;
  expirationDate: string | null;

  createdAt: string;
}
