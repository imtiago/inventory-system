import { ProductVariantDTO } from "./CommonDTO";

export interface InventoryLotDTO {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumStock: number;
  createdAt: Date;
}
export interface InventoryLotWithExtendsDTO extends InventoryLotDTO {
  productVariant: ProductVariantDTO;
}
