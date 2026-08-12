import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";

export interface ReserveInventoryRequest {
  productVariantId: string;
  quantity: number;
  originId: string;
  notes?: string;
  userId: string;
}

export class ReserveInventoryUseCase extends TransactionalUseCase<
  ReserveInventoryRequest,
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
    request: ReserveInventoryRequest,
    tx: Prisma.TransactionClient,
  ): Promise<StockMovement> {
    let inventory = await this.inventoryRepository.findByVariant(
      request.productVariantId,
      tx,
    );

    if (!inventory) {
      throw new Error("Inventory not found.");
    }

    inventory.reserve(request.quantity);
    await this.inventoryRepository.save(inventory, tx);

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
    await this.stockMovementRepository.create(movement, tx);
    return movement;
  }
}
