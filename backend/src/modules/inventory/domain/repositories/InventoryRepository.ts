// backend/src/modules/inventory/domain/repositories/InventoryRepository.ts
import { Prisma, StockMovementType } from "@prisma/client";
import { Inventory } from "../entities/Inventory";
import { StockMovement } from "../entities/StockMovement";

export interface InventoryRepository {
  findByVariant(
    variantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory | null>;
  update(
    inventory: Inventory,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory>;
  create(data: {
    productVariantId: string;
    quantity?: number;
    reservedQuantity?: number;
    minimumStock?: number;
  }): Promise<Inventory>;
  addMovement(
    data: {
      productVariantId: string;
      type: StockMovementType;
      quantity: number;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<StockMovement>;
}
