import { Inventory } from "@inventory/domain/entities/Inventory";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { ProductVariantSummaryDTO } from "./CommonDTO";

export interface InventoryDTO {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumStock: number;
  averageCost: number;
  /** Quantidade em lotes vencidos (validade anterior a hoje no fuso de negócio). */
  expired: number;
  createdAt: Date;
}
export interface InventoryWithExtendsDTO extends InventoryDTO {
  productVariant: ProductVariantSummaryDTO;
}

export interface IAdjustInventoryInput {
  productVariantId: string;
  countedQuantity: number;
  notes?: string;
  userId?: string;
}

export interface ICreateInventoryInput {
  productVariantId: string;
}

export interface IDispatchInventoryInput {
  productVariantId: string;
  quantity: number;
  origin: StockMovementOrigin;
  originReferenceId?: string;
  /** Baixa um lote específico (saída manual; aceita lote vencido). */
  inventoryLotId?: string;
  notes?: string;
  userId?: string;
}

export interface IReceiveInventoryInput {
  productVariantId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  manufacturingDate?: Date;
  expirationDate?: Date;
  origin: StockMovementOrigin;
  sourceType: InventoryLotSource;
  originReferenceId?: string;
  notes?: string;
  userId?: string;
  /**
   * Recebimento de compra: liga o lote ao item do pedido. Com batchNumber de um
   * lote existente da variante que não seja deste item → 409 BATCH_ALREADY_EXISTS.
   */
  purchaseItemId?: string;
}

export interface IReceiveInventoryOutput {
  inventory: Inventory;
  lot: InventoryLot;
}

export interface IRegisterScannedProductInput {
  barcode: string;
  boxCode: string;
  batchNumber?: string;
  expirationDate?: Date;
  quantity?: number;
  unitCost?: number;
  userId?: string;
}

export interface IReleaseInventoryInput {
  inventoryId: string;
  quantity: number;
  origin?: StockMovementOrigin;
  originId?: string;
  notes?: string;
  userId?: string;
}

export interface IReserveInventoryInput {
  productVariantId: string;
  quantity: number;
  origin?: StockMovementOrigin;
  originId?: string;
  notes?: string;
  userId?: string;
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
