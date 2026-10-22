import { IInventoryRepository } from "../../../domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IAdjustInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { IStockMovementOutput } from "@inventory/application/dto/StockMovementDTO";

export class AdjustInventoryUseCase extends TransactionalUseCase<
  IAdjustInventoryInput,
  IStockMovementOutput
> {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IAdjustInventoryInput,
  ): Promise<IStockMovementOutput> {
    let inventory = await this.inventoryRepository.findByProductVariantId(
      request.productVariantId
    );

    if (!inventory) {
      throw new Error("Inventory not found.");
    }
    const previousQuantity = inventory.quantity;

    inventory.adjust(request.quantity);

    await this.inventoryRepository.update(inventory);
    const movement = new StockMovement({
      inventoryId: inventory.id!,

      productVariantId: request.productVariantId,

      type: StockMovementType.ADJUSTMENT,

      origin: request.origin,

      quantity: Math.abs(request.quantity - previousQuantity),

      originId: null,

      userId: request.userId ?? null,

      notes: request.notes ?? null,
    });

    await this.stockMovementRepository.create(movement);

    return {
      id: movement.id,
      inventoryLotId: movement.inventoryLotId,
      quantity: movement.quantity,
      inventoryId: movement.inventoryId,
      origin: movement.origin,
      productVariantId: movement.productVariantId,
      userId: movement.userId,
      type: movement.type,
      notes: movement.notes,
      originId: movement.originId,
    };
  }
}
