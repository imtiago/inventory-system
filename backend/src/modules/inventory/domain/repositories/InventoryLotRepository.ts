import { Prisma } from "@prisma/client";
import { InventoryLot } from "../entities/InventoryLot";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryLotRepository extends ICrudRepository<InventoryLot> {
  findByProductVariantId(
    productVariantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryLot | null>;

  findByProductVariantIdAndBatchNumber(
    productVariantId: string,
    batchNumber: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryLot | null>;

  // save(lot: InventoryLot, tx?: Prisma.TransactionClient): Promise<InventoryLot>;
  // update(
  //   inventory: InventoryLot,
  //   tx?: Prisma.TransactionClient,
  // ): Promise<InventoryLot>;
  findAvailableByInventory(
    inventoryId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryLot[]>;
}
