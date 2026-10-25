import { InventoryBoxStock } from "../entities/InventoryBoxStock";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { BoxAllocationChange } from "../services/boxAllocations";
export interface IInventoryBoxStockRepository extends ICrudRepository<InventoryBoxStock> {
  findStock(
    inventoryLotId: string,
    boxId: string
  ): Promise<InventoryBoxStock | null>;

  sumAllocatedByLot(inventoryLotId: string): Promise<number>;

  /**
   * Mantém Σ alocações ≤ saldo de cada lote: trava (FOR UPDATE) as alocações dos
   * lotes, em ordem de createdAt/id, e abate o excesso das mais antigas primeiro,
   * apagando as que zeram. Exige transação; chamar depois de travar o inventário
   * e gravar os lotes (ordem das travas: inventário → lote → alocações).
   */
  reconcileBoxAllocations(lotIds: readonly string[]): Promise<BoxAllocationChange[]>;

  // create(
  //   stock: InventoryBoxStock,
  // ): Promise<InventoryBoxStock>;

  // update(
  //   id: string,
  //   quantity: number,
  // ): Promise<InventoryBoxStock>;
}
