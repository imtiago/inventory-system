import { InventoryBoxStock } from "../entities/InventoryBoxStock";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryBoxStockRepository extends ICrudRepository<InventoryBoxStock> {
  findStock(
    inventoryLotId: string,
    boxId: string
  ): Promise<InventoryBoxStock | null>;

  sumAllocatedByLot(inventoryLotId: string): Promise<number>;

  // create(
  //   stock: InventoryBoxStock,
  // ): Promise<InventoryBoxStock>;

  // update(
  //   id: string,
  //   quantity: number,
  // ): Promise<InventoryBoxStock>;
}
