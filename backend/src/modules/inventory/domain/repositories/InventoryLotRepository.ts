import { Prisma } from "@prisma/client";
import { InventoryLot } from "../entities/InventoryLot";
export interface InventoryLotRepository {
  findByVariant(
    productVariantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryLot | null>;
  findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryLot | null>;

  save(lot: InventoryLot, tx?: Prisma.TransactionClient): Promise<InventoryLot>;
  // update(
  //   inventory: InventoryLot,
  //   tx?: Prisma.TransactionClient,
  // ): Promise<InventoryLot>;
  findAvailableByInventory(
    inventoryId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryLot[]>;
}
