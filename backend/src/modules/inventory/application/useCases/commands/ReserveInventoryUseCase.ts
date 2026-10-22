import { InventoryRepository } from "../../../domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { IReserveInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { IStockMovementOutput } from "@inventory/application/dto/StockMovementDTO";

export class ReserveInventoryUseCase extends TransactionalUseCase<
  IReserveInventoryInput,
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
    request: IReserveInventoryInput,
  ): Promise<IStockMovementOutput> {
    let inventory = await this.inventoryRepository.findByVariant(
      request.productVariantId
    );

    if (!inventory) {
      throw new Error("Inventory not found.");
    }

    inventory.reserve(request.quantity);
    await this.inventoryRepository.save(inventory);

    const movement = new StockMovement({
      inventoryId: inventory.id,

      productVariantId: request.productVariantId,

      type: StockMovementType.RESERVE,

      origin: StockMovementOrigin.SALE,

      quantity: request.quantity,

      originId: request.originId,

      userId: request.userId,

      notes: request.notes,
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
