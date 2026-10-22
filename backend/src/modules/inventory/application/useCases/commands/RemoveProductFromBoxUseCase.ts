import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import {
  IInventoryBoxStockOutput,
  IRemoveProductFromBoxInput,
} from "@inventory/application/dto/InventoryBoxStockDTO";
import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

export class RemoveProductFromBoxUseCase extends TransactionalUseCase<
  IRemoveProductFromBoxInput,
  IInventoryBoxStockOutput
> {
  constructor(
    private readonly inventoryBoxStockRepository: IInventoryBoxStockRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IRemoveProductFromBoxInput,
  ): Promise<IInventoryBoxStockOutput> {
    if (request.quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    const stock = await this.inventoryBoxStockRepository.findStock(
      request.inventoryLotId,
      request.boxId,
    );

    if (!stock) {
      throw new NotFoundError("Produto não encontrado nesta caixa.", ErrorCodes.PRODUCT_NOT_IN_BOX);
    }

    if (stock.quantity < request.quantity) {
      throw new BusinessRuleError("Quantidade insuficiente na caixa.", ErrorCodes.INSUFFICIENT_BOX_STOCK);
    }

    stock.removeQuantity(request.quantity);

    const data = await this.inventoryBoxStockRepository.update(stock);
    return {
      id: data.id,
      boxId: data.boxId,
      inventoryLotId: data.inventoryLotId,
      quantity: data.quantity,
    };
  }
}
