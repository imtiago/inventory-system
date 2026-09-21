import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { InventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";

export interface CreateInventoryLotInput {
  inventoryId: string;
  batchNumber: string;
  quantity: number;
  expirationDate: Date;
}

export class CreateInventoryLotUseCase extends TransactionalUseCase<
  CreateInventoryLotInput,
  InventoryLot
> {
  constructor(
    private readonly inventoryLotRepository: InventoryLotRepository,
    // private numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CreateInventoryLotInput,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryLot> {
    console.log(request.productVariantId);
    const lot = new InventoryLot({
      inventoryId: request.inventoryId,
      productVariantId: request.productVariantId,
      quantity: request.quantity,
      // unitCost: request.unitCost,
      unitCost: 1,
      sourceType: InventoryLotSource.MANUAL,
      availableQuantity: request.availableQuantity,
      batchNumber: request.batchNumber,
      createdAt: request.createdAt,
      expirationDate: request.expirationDate,
      id: request.id,
      sourceId: request.sourceId,
      manufacturingDate: request.manufacturingDate,
    });

    return await this.inventoryLotRepository.save(lot, tx);
  }
}
