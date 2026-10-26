import { IReserveInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";

export class ReserveInventoryUseCase extends TransactionalUseCase<
  IReserveInventoryInput,
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
    request: IReserveInventoryInput,
  ): Promise<StockMovement> {
    // Trava a linha da variante antes de ler saldo/lotes (sem criar inventário).
    const inventory = await this.inventoryRepository.lockExistingByProductVariantId(
      request.productVariantId,
    );
    if (!inventory) {
      throw new NotFoundError("Estoque não encontrado.", ErrorCodes.INVENTORY_NOT_FOUND);
    }

    inventory.reserve(request.quantity);
    await this.inventoryRepository.update(inventory);

    const movement = new StockMovement({
      inventoryId: inventory.id,
      productVariantId: request.productVariantId,
      type: StockMovementType.RESERVE,
      origin: request.origin,
      quantity: request.quantity,
      previousQuantity: inventory.quantity,
      currentQuantity: inventory.quantity,
      averageCost: inventory.averageCost,
      originId: request.originId,
      userId: request.userId,
      notes: request.notes,
    });
    await this.stockMovementRepository.create(movement);
    return movement;
  }
}
