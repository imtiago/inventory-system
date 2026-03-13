// backend/src/modules/inventory/domain/repositories/InventoryRepository.ts
import { Inventory } from "../entities/Inventory";
import { StockMovement, StockMovementType } from "../entities/StockMovement";

export interface InventoryRepository {
  findByVariant(productVariantId: string): Promise<Inventory | null>;
  create(data: {
    productVariantId: string;
    quantity?: number;
    reservedQuantity?: number;
    minimumStock?: number;
  }): Promise<Inventory>;
  update(inventory: Inventory): Promise<Inventory>;
  addMovement(data: {
    productVariantId: string;
    type: StockMovementType;
    quantity: number;
  }): Promise<StockMovement>;
}
