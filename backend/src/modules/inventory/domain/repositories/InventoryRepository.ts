import { Inventory } from "../entities/Inventory";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryRepository extends ICrudRepository<Inventory> {
  findByProductVariantId(
    productVariantId: string
  ): Promise<Inventory | null>;
  // findById(
  //   id: string,
  // ): Promise<Inventory | null>;

  // save(inventory: Inventory): Promise<Inventory>;
  // update(
  //   inventory: Inventory,
  // ): Promise<Inventory>;
}
