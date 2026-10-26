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
  /**
   * Trava (FOR UPDATE, ordem de id) e lê os lotes criados pelo recebimento do pedido de compra
   * (origem PURCHASE, sourceId = pedido). Exige transação; chamar depois de travar o inventário
   * das variantes (ordem das travas: inventário → lote → alocações).
   */
  lockByPurchase(purchaseId: string): Promise<InventoryLot[]>;

  /** Lotes com saldo em ordem de consumo: validade, criação, id (FEFO). */
  findAvailableByInventory(
    inventoryId: string
  ): Promise<InventoryLot[]>;
}
