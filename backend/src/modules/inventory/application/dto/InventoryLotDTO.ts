import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";

export interface InventoryLotDTO {
  id: string;
  inventoryId: string;
  productVariantId: string;
  batchNumber: string | null;
  initialQuantity: number;
  remainingQuantity: number;
  /** Soma das quantidades do lote alocadas em caixas. */
  allocatedQuantity: number;
  unitCost: number;
  sourceType: InventoryLotSource;
  manufacturingDate: Date | null;
  expirationDate: Date | null;
  createdAt: Date;
}
