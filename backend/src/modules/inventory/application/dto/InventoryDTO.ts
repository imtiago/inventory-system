export interface ProductVariantDTO {
  id: string;
  productId: string;
  code: string;
  name: string;
  barcode: string | null;
  salePrice: number;
  createdAt: Date;
}

export interface InventoryDTO {
  id: string;
  productVariant: ProductVariantDTO;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumStock: number;
  createdAt: Date;
}
