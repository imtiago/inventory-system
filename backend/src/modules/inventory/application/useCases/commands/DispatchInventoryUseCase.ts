import { IDispatchInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ErrorCodes, InternalErrorCodes, InternalInvariantError, NotFoundError } from "@shared/domain/errors";

export class DispatchInventoryUseCase extends TransactionalUseCase<
  IDispatchInventoryInput,
  StockMovement[]
> {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly inventoryLotRepository: IInventoryLotRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(
    request: IDispatchInventoryInput,
  ): Promise<StockMovement[]> {
    const inventory = await this.inventoryRepository.findByProductVariantId(
      request.productVariantId,
    );
    if (!inventory) {
      throw new NotFoundError("Estoque não encontrado.", ErrorCodes.INVENTORY_NOT_FOUND);
    }

    // Valida disponível (considera reservado) antes de qualquer gravação.
    inventory.dispatch(request.quantity);

    const lots = await this.inventoryLotRepository.findAvailableByInventory(
      inventory.id,
    );

    const consumptions: { lot: (typeof lots)[number]; quantity: number }[] = [];
    let remaining = request.quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, lot.remainingQuantity);
      lot.consume(quantity);
      consumptions.push({ lot, quantity });
      remaining -= quantity;
    }
    if (remaining > 0) {
      throw new InternalInvariantError("Os lotes do estoque estão inconsistentes.", InternalErrorCodes.INVENTORY_LOTS_INCONSISTENT);
    }

    await this.inventoryRepository.update(inventory);

    const movements: StockMovement[] = [];
    let balance = inventory.quantity + request.quantity;
    for (const { lot, quantity } of consumptions) {
      await this.inventoryLotRepository.update(lot);
      const movement = new StockMovement({
        inventoryId: inventory.id,
        inventoryLotId: lot.id,
        productVariantId: request.productVariantId,
        type: StockMovementType.OUT,
        origin: request.origin,
        quantity,
        previousQuantity: balance,
        currentQuantity: balance - quantity,
        averageCost: inventory.averageCost,
        originId: request.originReferenceId,
        userId: request.userId,
        notes: request.notes,
      });
      balance -= quantity;
      await this.stockMovementRepository.create(movement);
      movements.push(movement);
    }

    return movements;
  }
}
