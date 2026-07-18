import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";

interface AddInventoryRequest {
  productVariantId: string;
  quantity: number;
}

export class AddInventory {
  constructor(private repo: InventoryRepository) {}

  async execute(data: AddInventoryRequest): Promise<Inventory> {
    let inventory = await this.repo.findByVariant(data.productVariantId);

    if (!inventory) {
      inventory = new Inventory({
        productVariantId: data.productVariantId,
      });
    }

    const movement = inventory.addStock(data.quantity);

    await this.repo.save(inventory);

    await this.repo.addMovement(movement);

    return inventory;
  }
}
