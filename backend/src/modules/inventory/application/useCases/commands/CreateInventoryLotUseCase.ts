import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import {
  ICreateInventoryLotInput,
  IInventoryLotOutput,
} from "@inventory/application/dto/InventoryLotDTO";

export class CreateInventoryLotUseCase extends TransactionalUseCase<
  ICreateInventoryLotInput,
  IInventoryLotOutput
> {
  constructor(
    private readonly repository: IInventoryLotRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateInventoryLotInput,
  ): Promise<IInventoryLotOutput> {
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

    const data = await this.repository.create(lot);
    return {
      id: data.id,
      availableQuantity: data.availableQuantity,
      batchNumber: data.batchNumber,
      code: data.code,
      expirationDate: data.expirationDate,
      minimumStock: data.minimumStock,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
    };
  }
}
