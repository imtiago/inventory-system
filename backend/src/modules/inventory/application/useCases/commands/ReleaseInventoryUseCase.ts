import { IReleaseInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

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
    const found = await this.inventoryRepository.findById(request.inventoryId);
    // Trava pela variante e usa a leitura feita sob a trava (saldo atualizado).
    const inventory = found
      ? await this.inventoryRepository.lockExistingByProductVariantId(
          found.productVariantId,
        )
      : null;
    if (!inventory) {
      throw new NotFoundError("Estoque não encontrado.", ErrorCodes.INVENTORY_NOT_FOUND);
    }

    // Só libera o que aquele documento reservou (Σ RESERVE − Σ RELEASE da origem).
    // Lido sob a trava da variante, então outra liberação concorrente já terminou.
    const documentMovements = await this.stockMovementRepository.findByOrigin(
      request.origin,
      request.originId,
    );
    const reservedByDocument = documentMovements
      .filter((m) => m.inventoryId === inventory.id)
      .reduce(
        (sum, m) =>
          m.type === StockMovementType.RESERVE
            ? sum + m.quantity
            : m.type === StockMovementType.RELEASE
              ? sum - m.quantity
              : sum,
        0,
      );
    if (request.quantity > reservedByDocument) {
      throw new ConflictError(
        "A liberação excede o reservado por este documento.",
        ErrorCodes.RELEASE_EXCEEDS_RESERVATION,
      );
    }

    const previousReserved = inventory.reservedQuantity;
    inventory.release(request.quantity);
    await this.inventoryRepository.update(inventory);

    const movement = new StockMovement({
      inventoryId: inventory.id,
      productVariantId: inventory.productVariantId,
      type: StockMovementType.RELEASE,
      origin: request.origin,
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
