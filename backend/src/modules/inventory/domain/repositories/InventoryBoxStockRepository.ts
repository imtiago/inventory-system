import { Prisma } from "@prisma/client";
import { InventoryBoxStock } from "../entities/InventoryBoxStock";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryBoxStockRepository extends ICrudRepository<InventoryBoxStock> {
  findStock(
    inventoryLotId: string,
    boxId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryBoxStock | null>;

  // create(
  //   stock: InventoryBoxStock,
  //   tx?: Prisma.TransactionClient,
  // ): Promise<InventoryBoxStock>;

  // update(
  //   id: string,
  //   quantity: number,
  //   tx?: Prisma.TransactionClient,
  // ): Promise<InventoryBoxStock>;
}
