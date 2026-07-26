import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";

interface AddInventoryRequest {
  productVariantId: string;
  quantity: number;
}

export class AddInventory extends TransactionalUseCase<
  AddInventoryRequest,
  Inventory
> {
  constructor(
    private inventoryRepo: InventoryRepository,
    private movementRepo: StockMovementRepository,
    private catalogoService: CatalogService,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: AddInventoryRequest,
    tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
    let inventory = await this.inventoryRepo.findByVariant(
      request.productVariantId,
      tx,
    );

    if (!inventory) {
      const variant = await this.catalogoService.getProductVariant(
        request.productVariantId,
      );
      if (!variant) return new Error("variante não encontrada");
      inventory = new Inventory({
        productVariantId: request.productVariantId,
      });
    }

    const movement = inventory.addStock(request.quantity);

    await this.inventoryRepo.save(inventory, tx);
    await this.movementRepo.create(movement, tx);

    return inventory;
  }
}
