import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "@inventory/domain/entities/Inventory";

export interface CreateInventoryInput {
  productVariantId: string;
}

export class CreateInventoryUseCase extends TransactionalUseCase<
  CreateInventoryInput,
  Inventory
> {
  constructor(
    private readonly repository: IInventoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CreateInventoryInput,
    tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const inventory = new Inventory({
      productVariantId: request.productVariantId,
    });

    return await this.repository.create(inventory);
  }
}
