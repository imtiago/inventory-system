import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import { IRemoveProductFromBoxInput } from "@inventory/application/dto/InventoryBoxStockDTO";

export class RemoveProductFromBoxUseCase extends TransactionalUseCase<
  IRemoveProductFromBoxInput,
  InventoryBoxStock
> {
  constructor(
    private readonly inventoryBoxStockRepository: IInventoryBoxStockRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IRemoveProductFromBoxInput,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryBoxStock> {
    if (request.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    const stock = await this.inventoryBoxStockRepository.findStock(
      request.inventoryLotId,
      request.boxId,
    );

    if (!stock) {
      throw new Error("Product is not stored in this box.");
    }

    if (stock.quantity < request.quantity) {
      throw new Error("Insufficient quantity in the box.");
    }

    stock.addQuantity(request.quantity);

    return this.inventoryBoxStockRepository.update(stock);
  }
}
