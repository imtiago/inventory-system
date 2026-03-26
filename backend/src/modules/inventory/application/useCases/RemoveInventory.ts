// backend/src/modules/inventory/application/useCases/RemoveInventory.ts
import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { StockMovement } from "../../domain/entities/StockMovement";
import { TransactionManager } from "@shared/domain/TransactionManager";

export class RemoveInventory {
  constructor(
    private repository: InventoryRepository,
    private transaction: TransactionManager,
  ) {}

  async execute(
    productVariantId: string,
    quantity: number,
  ): Promise<Inventory> {
    return this.transaction.execute(async (tx) => {
      const inventory = await this.repository.findByVariant(productVariantId);
      if (!inventory) {
        throw new Error("Inventory not found");
      }

      if (inventory.quantity < quantity) {
        throw new Error("Not enough stock to remove");
      }

      inventory.quantity -= quantity;

      // Atualiza o estoque
      const updated = await this.repository.update(inventory, tx);

      // Cria movimento de saída
      await this.repository.addMovement(
        {
          productVariantId,
          type: "OUT",
          quantity,
        } as StockMovement,
        tx,
      );

      return updated;
    });
  }
}
