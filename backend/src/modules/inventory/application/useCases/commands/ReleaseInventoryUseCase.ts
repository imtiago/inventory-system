import { IReleaseInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";

export class ReleaseInventoryUseCase extends TransactionalUseCase<
  IReleaseInventoryInput,
  StockMovement
> {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(
    request: IReleaseInventoryInput,
  ): Promise<StockMovement> {
    const inventory = await this.inventoryRepository.findById(
      request.inventoryId,
    );
    if (!inventory) {
      throw new NotFoundError("Estoque não encontrado.", ErrorCodes.INVENTORY_NOT_FOUND);
    }

    const previousReserved = inventory.reservedQuantity;
    inventory.release(request.quantity);
    await this.inventoryRepository.update(inventory);

    const movement = new StockMovement({
      inventoryId: inventory.id,
      productVariantId: inventory.productVariantId,
      type: StockMovementType.RELEASE,
      origin: request.origin ?? StockMovementOrigin.SALE,
      quantity: request.quantity,
      previousQuantity: inventory.quantity,
      currentQuantity: inventory.quantity,
      averageCost: inventory.averageCost,
      originId: request.originId,
      userId: request.userId,
      notes:
        request.notes ??
        `Inventory reservation released. Reserved quantity: ${previousReserved} -> ${inventory.reservedQuantity}.`,
    });
    await this.stockMovementRepository.create(movement);
    return movement;
  }
}
