import { IInventoryRepository } from "../../../domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IAdjustInventoryInput } from "@inventory/application/dto/InventoryDTO";

export class AdjustInventoryUseCase extends TransactionalUseCase<
  IAdjustInventoryInput,
  StockMovement
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
    tx: Prisma.TransactionClient,
  ): Promise<StockMovement> {
    let inventory = await this.inventoryRepository.findByProductVariantId(
      request.productVariantId,
      tx,
    );

    if (!inventory) {
      throw new Error("Inventory not found.");
    }
    const previousQuantity = inventory.quantity;

    inventory.adjust(request.quantity);

    await this.inventoryRepository.update(inventory);
    console.log(request.userId);
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

    return movement;
  }
}
