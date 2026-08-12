import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { InventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";

interface ReceiveInventoryRequest {
  productVariantId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expirationDate?: Date;
  manufacturingDate?: Date;
  origin: StockMovementOrigin;
  originReferenceId?: string;
  notes?: string;
  userId: string;
}

export class ReceiveInventoryUseCase extends TransactionalUseCase<
  ReceiveInventoryRequest,
  Inventory
> {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryLotRepository: InventoryLotRepository,
    private readonly stockMovementRepository: StockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ReceiveInventoryRequest,
    tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
    let inventory = await this.inventoryRepository.findByVariant(
      request.productVariantId,
      tx,
    );

    if (!inventory) {
      inventory = new Inventory({
        productVariantId: request.productVariantId,
      });
    }

    const previousQuantity = inventory.quantity;

    inventory.receive({
      quantity: request.quantity,
      unitCost: request.unitCost,
    });

    const currentQuantity = inventory.quantity;
    const averageCost = inventory.averageCost;
    const lot = new InventoryLot({
      inventoryId: inventory.id,

      productVariantId: request.productVariantId,

      sourceType: request.origin,
      // sourceType: InventoryLotSourceType,

      sourceId: request.originReferenceId,

      quantity: request.quantity,

      availableQuantity: request.quantity,

      unitCost: request.unitCost,

      batchNumber: request.batchNumber,

      expirationDate: request.expirationDate,

      manufacturingDate: request.manufacturingDate,
    });

    await this.inventoryRepository.save(inventory, tx);

    await this.inventoryLotRepository.save(lot, tx);
    const movement = new StockMovement({
      inventoryId: inventory.id,

      productVariantId: request.productVariantId,

      type: StockMovementType.IN,

      origin: request.origin,

      quantity: request.quantity,

      previousQuantity,

      currentQuantity,

      averageCost,
      inventoryLotId: lot.id,

      originId: request.originReferenceId,

      userId: request.userId,

      notes: request.notes,
    });

    await this.stockMovementRepository.create(movement, tx);
    return inventory;
  }
}
