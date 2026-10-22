import { Inventory } from "../entities/Inventory";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryRepository extends ICrudRepository<Inventory> {
  findByProductVariantId(
    productVariantId: string
  ): Promise<Inventory | null>;
  /** Trava a linha (FOR UPDATE); cria um inventário vazio se não existir. Exige transação. */
  lockByProductVariantId(productVariantId: string): Promise<Inventory>;
  /** Trava a linha (FOR UPDATE); retorna null (sem criar) se não existir. Exige transação. */
  lockExistingByProductVariantId(
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
