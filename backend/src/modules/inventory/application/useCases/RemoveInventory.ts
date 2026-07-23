// backend/src/modules/inventory/application/useCases/RemoveInventory.ts
import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";

export class RemoveInventory {
  constructor(
    private inventoryRepository: InventoryRepository,
    private movementRepository: StockMovementRepository,
    private transaction: TransactionManager,
  ) {}

  async execute(
    productVariantId: string,
    quantity: number,
    reason?: string,
  ): Promise<Inventory> {
    return this.transaction.execute(async (tx) => {
      const inventory = await this.inventoryRepository.findByVariant(
        productVariantId,
        tx,
      );
      if (!inventory) {
        throw new Error("Inventory not found");
      }

      const movement = inventory.removeStock(quantity, reason);

      // Atualiza o estoque
      const updated = await this.inventoryRepository.save(inventory, tx);

      // Cria movimento de saída
      await this.movementRepository.create(movement, tx);

      return updated;
    });
  }
}
