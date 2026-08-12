import { Prisma } from "@prisma/client";
import { Inventory } from "../entities/Inventory";
export interface InventoryRepository {
  findByVariant(
    productVariantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory | null>;
  findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory | null>;

  save(inventory: Inventory, tx?: Prisma.TransactionClient): Promise<Inventory>;
  // update(
  //   inventory: Inventory,
  //   tx?: Prisma.TransactionClient,
  // ): Promise<Inventory>;
}
