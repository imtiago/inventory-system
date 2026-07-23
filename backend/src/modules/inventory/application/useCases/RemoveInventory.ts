// backend/src/modules/inventory/application/useCases/RemoveInventory.ts
import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";

interface RemoveInventoryRequest {
  productVariantId: string;
  quantity: number;
  reason?: string;
}
export class RemoveInventory extends TransactionalUseCase<
  RemoveInventoryRequest,
  Inventory
> {
  constructor(
    private inventoryRepository: InventoryRepository,
    private movementRepository: StockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: RemoveInventoryRequest,
    tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const inventory = await this.inventoryRepository.findByVariant(
      request.productVariantId,
      tx,
    );
    if (!inventory) {
      throw new Error("Inventory not found");
    }

    const movement = inventory.removeStock(request.quantity, request.reason);

    // Atualiza o estoque
    const updated = await this.inventoryRepository.save(inventory, tx);

    // Cria movimento de saída
    await this.movementRepository.create(movement, tx);

    return updated;
  }
}
