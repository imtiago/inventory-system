import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";

interface AddInventoryRequest {
  productVariantId: string;
  quantity: number;
}

export class AddInventory {
  constructor(
    private inventoryRepo: InventoryRepository,
    private movementRepo: StockMovementRepository,
    private transaction: TransactionManager,
  ) {}

  async execute(data: AddInventoryRequest): Promise<Inventory> {
    return this.transaction.execute(async (tx) => {
      let inventory = await this.inventoryRepo.findByVariant(
        data.productVariantId,
        tx,
      );

      if (!inventory) {
        inventory = new Inventory({
          productVariantId: data.productVariantId,
        });
      }

      const movement = inventory.addStock(data.quantity);

      await this.inventoryRepo.save(inventory, tx);
      await this.movementRepo.create(movement, tx);

      return inventory;
    });
  }
}
