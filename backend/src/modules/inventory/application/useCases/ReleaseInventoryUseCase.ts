import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";

interface ReleaseInventoryRequest {
  inventoryId: string;

  quantity: number;

  userId: string;

  notes?: string;
}

export class ReleaseInventoryUseCase extends TransactionalUseCase<
  ReleaseInventoryRequest,
  Inventory
> {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly stockMovementRepository: StockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ReleaseInventoryRequest,
    tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
    let inventory = await this.inventoryRepository.findById(
      request.inventoryId,
      tx,
    );

    if (!inventory) {
      throw new Error("Inventory not found.");
    }

    const previousQuantity = inventory.quantity;

    const previousReservedQuantity = inventory.reservedQuantity;

    inventory.release(request.quantity);

    await this.inventoryRepository.save(inventory, tx);
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

    await this.stockMovementRepository.create(movement, tx);

    return movement;
  }
}
