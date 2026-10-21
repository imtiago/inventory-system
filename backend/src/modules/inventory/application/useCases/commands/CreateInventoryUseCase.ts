import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { ICreateInventoryInput } from "@inventory/application/dto/InventoryDTO";

export class CreateInventoryUseCase extends TransactionalUseCase<
  ICreateInventoryInput,
  Inventory
> {
  constructor(
    private readonly repository: IInventoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateInventoryInput,
    tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const inventory = new Inventory({
      productVariantId: request.productVariantId,
    });

    return await this.repository.create(inventory);
  }
}
