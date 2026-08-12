import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";

interface AdjustInventoryRequest {
  productVariantId: string;

  quantity: number;

  origin: StockMovementOrigin;

  userId?: string;

  notes?: string;
}

export class AdjustInventoryUseCase extends TransactionalUseCase<
  AdjustInventoryRequest,
  StockMovement
> {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly stockMovementRepository: StockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: AdjustInventoryRequest,
    tx: Prisma.TransactionClient,
  ): Promise<StockMovement> {
    let inventory = await this.inventoryRepository.findByVariant(
      request.productVariantId,
      tx,
    );

    if (!inventory) {
      throw new Error("Inventory not found.");
    }
    const previousQuantity = inventory.quantity;

    inventory.adjust(request.quantity);

    await this.inventoryRepository.save(inventory, tx);

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

    await this.stockMovementRepository.create(movement, tx);

    return movement;
  }
}
