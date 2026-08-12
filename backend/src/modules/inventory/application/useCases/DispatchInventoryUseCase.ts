import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { InventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovement } from "@inventory/domain/entities/StockMovement";

interface DispatchInventoryRequest {
  productVariantId: string;
  quantity: number;
  origin: StockMovementOrigin;
  originReferenceId?: string;
  notes?: string;
  userId: string;
}

export class DispatchInventoryUseCase extends TransactionalUseCase<
  DispatchInventoryRequest,
  Inventory
> {
  constructor(
    private inventoryRepository: InventoryRepository,
    private inventoryLotRepository: InventoryLotRepository,
    private movementRepository: StockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: DispatchInventoryRequest,
    tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const inventory = await this.inventoryRepository.findByVariant(
      request.productVariantId,
      tx,
    );
    if (!inventory) {
      throw new Error("Inventory not found");
    }

    inventory.dispatch(request.quantity);

    let remaining = request.quantity;

    const lots = await this.inventoryLotRepository.findAvailableByInventory(
      inventory.id!,
      tx,
    );

    for (const lot of lots) {
      if (remaining <= 0) break;

      const consume = Math.min(remaining, lot.remainingQuantity);

      lot.consume(consume);

      await this.inventoryLotRepository.save(lot, tx);

      remaining -= consume;
    }

    if (remaining > 0) throw new Error("Inventory lots are inconsistent.");

    await this.inventoryRepository.save(inventory, tx);
    const movement = new StockMovement({
      inventoryId: inventory.id!,

      productVariantId: request.productVariantId,

      type: StockMovementType.OUT,

      origin: request.origin,

      quantity: request.quantity,

      originId: request.originReferenceId,

      userId: request.userId,

      notes: request.notes,
    });

    await this.movementRepository.create(movement, tx);

    return movement;

    // const movement = inventory.removeStock(request.quantity, request.reason);

    // // Atualiza o estoque
    // const updated = await this.inventoryRepository.save(inventory, tx);

    // // Cria movimento de saída
    // await this.movementRepository.create(movement, tx);

    // return updated;
  }
}
