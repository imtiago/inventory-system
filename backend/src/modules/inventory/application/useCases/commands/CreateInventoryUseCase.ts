import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "@inventory/domain/entities/Inventory";
import {
  ICreateInventoryInput,
  IInventoryOutput,
} from "@inventory/application/dto/InventoryDTO";

export class CreateInventoryUseCase extends TransactionalUseCase<
  ICreateInventoryInput,
  IInventoryOutput
> {
  constructor(
    private readonly repository: IInventoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateInventoryInput,
  ): Promise<IInventoryOutput> {
    const inventory = new Inventory({
      productVariantId: request.productVariantId,
    });

    const data = await this.repository.create(inventory);
    return {
      id: data.id,
      availableQuantity: data.availableQuantity,
      code: data.code,
      minimumStock: data.minimumStock,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
    };
  }
}
