import { ProductVariantDTO } from "./CommonDTO";

export interface InventoryLotDTO {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumStock: number;
  batchNumber: string;
  createdAt: Date;
  expirationDate: Date;
}
export interface InventoryLotWithExtendsDTO extends InventoryLotDTO {
  productVariant: ProductVariantDTO;
}
