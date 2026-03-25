import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { StockMovementType } from "@prisma/client";

export class AddInventory {
  constructor(private repo: InventoryRepository) {}

  async execute(productVariantId: string, quantity: number) {
    if (quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    let inventory = await this.repo.findByVariant(productVariantId);

    if (!inventory) {
      inventory = await this.repo.create({
        productVariantId,
        quantity: 0,
        reservedQuantity: 0,
        minimumStock: 0,
      });
    }

    inventory.quantity += quantity;

    await this.repo.update(inventory);

    await this.repo.addMovement({
      productVariantId,
      type: StockMovementType.IN,
      quantity,
    });

    return inventory;
  }
}
