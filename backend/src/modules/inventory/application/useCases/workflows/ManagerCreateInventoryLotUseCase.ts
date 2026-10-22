import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { CreateInventoryLotUseCase } from "../commands/CreateInventoryLotUseCase";
import { AdjustInventoryUseCase } from "../commands/AdjustInventoryUseCase";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { ICreateInventoryLotInput } from "@inventory/application/dto/InventoryLotDTO";
import { GetInventoryByIdReadUseCase } from "../queries/GetInventoryByIdReadUseCase";

export class ManagerCreateInventoryLotUseCase extends TransactionalUseCase<
  ICreateInventoryLotInput,
  InventoryLot
> {
  constructor(
    private readonly getInventoryByIdUseCase: GetInventoryByIdReadUseCase,
    private readonly createInventoryLotUseCase: CreateInventoryLotUseCase,
    private readonly adjustInventoryUseCase: AdjustInventoryUseCase,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateInventoryLotInput,
  ): Promise<InventoryLot> {
    const inventory = await this.getInventoryByIdUseCase.execute(
      request.inventoryId,
    );
    console.log("tiago");
    if (!inventory) {
      console.log("tiago da silva oliveira, o inventory não foi encontrado");
    }
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
