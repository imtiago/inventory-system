// backend/src/modules/inventory/application/useCases/RemoveInventory.ts
import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { StockMovement } from "../../domain/entities/StockMovement";

export class RemoveInventory {
  constructor(private repository: InventoryRepository) {}

  async execute(
    productVariantId: string,
    quantity: number,
  ): Promise<Inventory> {
    const inventory = await this.repository.findByVariant(productVariantId);
    if (!inventory) {
      throw new Error("Inventory not found");
    }

    if (inventory.quantity < quantity) {
      throw new Error("Not enough stock to remove");
    }

    inventory.quantity -= quantity;

    // Atualiza o estoque
    const updated = await this.repository.update(inventory);

    // Cria movimento de saída
    await this.repository.addMovement({
      productVariantId,
      type: "EXIT",
      quantity,
    } as StockMovement);

    return updated;
  }
}
