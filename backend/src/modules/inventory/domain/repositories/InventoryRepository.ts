import { Prisma } from "@prisma/client";
import { Inventory } from "../entities/Inventory";
// import { StockMovement } from "../entities/StockMovement";

export interface InventoryRepository {
  findByVariant(
    productVariantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory | null>;

  save(inventory: Inventory, tx?: Prisma.TransactionClient): Promise<Inventory>;

  // addMovement(movement: StockMovement): Promise<StockMovement>;
}
