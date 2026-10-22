import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
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

export interface IAdjustInventoryInput {
  productVariantId: string;

  quantity: number;

  origin: StockMovementOrigin;

  userId?: string;

  notes?: string;
}

export interface ICreateInventoryInput {
  productVariantId: string;
}

export interface IDispatchInventoryInput {
  productVariantId: string;
  quantity: number;
  origin: StockMovementOrigin;
  originReferenceId?: string;
  notes?: string;
  userId: string;
}

export interface IReceiveInventoryInput {
  productVariantId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expirationDate?: Date;
  manufacturingDate?: Date;
  origin: StockMovementOrigin;
  originReferenceId?: string;
  notes?: string;
  userId: string;
}

export interface IRegisterScannedProductInput {
  barcode: string;
  boxCode: string;
  batchNumber?: string;
  expirationDate?: Date;
  quantity?: number;
}

export interface IReleaseInventoryInput {
  inventoryId: string;

  quantity: number;

  userId: string;

  notes?: string;
}

export interface IReserveInventoryInput {
  productVariantId: string;
  quantity: number;
  originId: string;
  notes?: string;
  userId: string;
}

export interface IInventoryOutput {
  id: string;
  productVariantId: string;
  code: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumStock: number;
}
