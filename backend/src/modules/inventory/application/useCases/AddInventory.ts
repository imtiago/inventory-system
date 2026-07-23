import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { CatalogService } from "@catalog/application/services/CatalogService";

interface AddInventoryRequest {
  productVariantId: string;
  quantity: number;
}

export class AddInventory {
  constructor(
    private inventoryRepo: InventoryRepository,
    private movementRepo: StockMovementRepository,
    private catalogoService: CatalogService,
    private transaction: TransactionManager,
  ) {}

  async execute(data: AddInventoryRequest): Promise<Inventory> {
    return this.transaction.execute(async (tx) => {
      let inventory = await this.inventoryRepo.findByVariant(
        data.productVariantId,
        tx,
      );

      if (!inventory) {
        const variant = await this.catalogoService.getProductVariant(
          data.productVariantId,
        );
        if (!variant) return new Error("varainte não encontrada");
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
