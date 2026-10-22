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

export interface ICreateInventoryLotInput {
  inventoryId: string;
  batchNumber: string;
  productVariantId: string;
  quantity: number;
  expirationDate: Date;
  manufacturingDate?: Date;
  unitCost: number;
}


export interface IInventoryLotOutput {
  id: string;
  code: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumStock: number;
  batchNumber: string;
  expirationDate: Date;
}