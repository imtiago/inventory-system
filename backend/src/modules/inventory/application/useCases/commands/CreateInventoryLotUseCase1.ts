import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { CreateInventoryLotUseCase } from "./CreateInventoryLotUseCase";
import { AdjustInventoryUseCase } from "./AdjustInventoryUseCase";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { ICreateInventoryLotInput } from "@inventory/application/dto/InventoryLotDTO";

export class CreateInventoryLotUseCase1 extends TransactionalUseCase<
  ICreateInventoryLotInput,
  InventoryLot
> {
  constructor(
    private readonly createInventoryLotUseCase: CreateInventoryLotUseCase,
    private readonly adjustInventoryUseCase: AdjustInventoryUseCase,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateInventoryLotInput,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryLot> {
    const lot = new InventoryLot({
      inventoryId: request.inventoryId,
      productVariantId: request.productVariantId,
      quantity: request.quantity,
      unitCost: request.unitCost,
      sourceType: InventoryLotSource.MANUAL,
      availableQuantity: request.availableQuantity,
      batchNumber: request.batchNumber,
      createdAt: request.createdAt,
      expirationDate: request.expirationDate,
      id: request.id,
      sourceId: request.sourceId,
      manufacturingDate: request.manufacturingDate,
    });

    const inventoryLot = await this.createInventoryLotUseCase.execute({
      inventoryId: request.inventoryId,
      productVariantId: request.productVariantId,
      quantity: request.quantity,
      unitCost: request.unitCost,
      sourceType: InventoryLotSource.MANUAL,
      availableQuantity: request.availableQuantity,
      batchNumber: request.batchNumber,
      createdAt: request.createdAt,
      expirationDate: request.expirationDate,
      id: request.id,
      sourceId: request.sourceId,
      manufacturingDate: request.manufacturingDate,
    });

    await this.adjustInventoryUseCase.execute({
      productVariantId: inventoryLot.productVariantId,
      quantity: inventoryLot.quantity,
      origin: StockMovementOrigin.MANUAL,
      userId: request.userId,
    });

    return inventoryLot;
  }
}
