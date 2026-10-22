import { InventoryRepository } from "../../../domain/repositories/InventoryRepository";
import { Inventory } from "../../../domain/entities/Inventory";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { IReleaseInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { IStockMovementOutput } from "@inventory/application/dto/StockMovementDTO";

export class ReleaseInventoryUseCase extends TransactionalUseCase<
  IReleaseInventoryInput,
  IStockMovementOutput
> {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly stockMovementRepository: StockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IReleaseInventoryInput,
  ): Promise<IStockMovementOutput> {
    let inventory = await this.inventoryRepository.findById(
      request.inventoryId
    );

    if (!inventory) {
      throw new Error("Inventory not found.");
    }

    const previousQuantity = inventory.quantity;

    const previousReservedQuantity = inventory.reservedQuantity;

    inventory.release(request.quantity);

    await this.inventoryRepository.save(inventory);
    const movement = new StockMovement({
      inventoryId: inventory.id!,

      productVariantId: inventory.productVariantId,

      type: StockMovementType.ADJUSTMENT,

      origin: StockMovementOrigin.MANUAL,

      quantity: request.quantity,

      userId: request.userId,

      notes:
        request.notes ??
        `Inventory reservation released. Reserved quantity: ${previousReservedQuantity} -> ${inventory.reservedQuantity}.`,
    });

    await this.stockMovementRepository.create(movement);

    return {
      id: movement.id,
      inventoryId: movement.inventoryId,
      origin: movement.origin,
      productVariantId: movement.productVariantId,
      quantity: movement.quantity,
      type: movement.type,
      userId: movement.userId,
      notes: movement.notes,
      originId: movement.originId,
    };
  }
}
