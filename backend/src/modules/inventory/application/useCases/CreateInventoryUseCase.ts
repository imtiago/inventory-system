import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { InventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "@inventory/domain/entities/Inventory";

export interface CreateInventoryInput {
  productVariantId: string;
}

export class CreateInventoryUseCase extends TransactionalUseCase<
  CreateInventoryInput,
  Inventory
> {
  constructor(
    private readonly repository: InventoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CreateInventoryInput,
    tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const existInventory = await this.repository.findByVariant(
      request.productVariantId,
      tx,
    );
    if (existInventory) throw new Error("Inventory exist");

    const inventory = new Inventory({
      productVariantId: request.productVariantId,
    });

    return await this.repository.save(inventory, tx);
  }
}
