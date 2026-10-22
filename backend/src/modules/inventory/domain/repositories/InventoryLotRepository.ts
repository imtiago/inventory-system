import { InventoryLot } from "../entities/InventoryLot";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryLotRepository extends ICrudRepository<InventoryLot> {
  findByProductVariantIdAndBatchNumber(
    productVariantId: string,
    batchNumber: string
  ): Promise<InventoryLot | null>;

  // save(lot: InventoryLot): Promise<InventoryLot>;
  // update(
  //   inventory: InventoryLot,
  // ): Promise<InventoryLot>;
  findAvailableByInventory(
    inventoryId: string
  ): Promise<InventoryLot[]>;
}
