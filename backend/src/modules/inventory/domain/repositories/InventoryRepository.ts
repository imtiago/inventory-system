import { Prisma } from "@prisma/client";
import { Inventory } from "../entities/Inventory";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryRepository extends ICrudRepository<Inventory> {
  findByProductVariantId(
    productVariantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory | null>;
  // findById(
  //   id: string,
  //   tx?: Prisma.TransactionClient,
  // ): Promise<Inventory | null>;

  // save(inventory: Inventory, tx?: Prisma.TransactionClient): Promise<Inventory>;
  // update(
  //   inventory: Inventory,
  //   tx?: Prisma.TransactionClient,
  // ): Promise<Inventory>;
}
