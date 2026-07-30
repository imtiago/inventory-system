import { ProductVariantDTO } from "./CommonDTO";

export interface InventoryDTO {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumStock: number;
  createdAt: Date;
}
export interface InventoryWithExtendsDTO extends InventoryDTO {
  productVariant: ProductVariantDTO;
}
