import { IAdjustInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";

export class AdjustInventoryUseCase extends TransactionalUseCase<
  IAdjustInventoryInput,
  StockMovement | null
> {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly inventoryLotRepository: IInventoryLotRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(
    request: IAdjustInventoryInput,
  ): Promise<StockMovement | null> {
    const inventory = await this.inventoryRepository.findByProductVariantId(
      request.productVariantId,
    );
    if (!inventory) {
      throw new Error("Inventory not found.");
    }

    const previousQuantity = inventory.quantity;
    const counted = request.countedQuantity;
    const difference = counted - previousQuantity;

    // Valida a contagem (não negativa) antes de qualquer gravação.
    inventory.adjust(counted);
    if (difference === 0) {
      return null;
    }

    let movementLotId: string | null = null;

    if (difference < 0) {
      const lots = await this.inventoryLotRepository.findAvailableByInventory(
        inventory.id,
      );
      const touched: InventoryLot[] = [];
      let remaining = -difference;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const quantity = Math.min(remaining, lot.remainingQuantity);
        lot.consume(quantity);
        touched.push(lot);
        remaining -= quantity;
      }
      if (remaining > 0) {
        throw new Error("Inventory lots are inconsistent.");
      }
      await this.inventoryRepository.update(inventory);
      for (const lot of touched) {
        await this.inventoryLotRepository.update(lot);
      }
    } else {
      const lot = new InventoryLot({
        inventoryId: inventory.id,
        productVariantId: inventory.productVariantId,
        sourceType: InventoryLotSource.MANUAL,
        initialQuantity: difference,
        unitCost: inventory.averageCost,
      });
      await this.inventoryRepository.update(inventory);
      await this.inventoryLotRepository.create(lot);
      movementLotId = lot.id;
    }

    const movement = new StockMovement({
      inventoryId: inventory.id,
      inventoryLotId: movementLotId,
      productVariantId: inventory.productVariantId,
      type: StockMovementType.ADJUSTMENT,
      origin: StockMovementOrigin.INVENTORY,
      quantity: Math.abs(difference),
      previousQuantity,
      currentQuantity: inventory.quantity,
      averageCost: inventory.averageCost,
      userId: request.userId,
      notes: request.notes,
    });
    await this.stockMovementRepository.create(movement);
    return movement;
  }
}
