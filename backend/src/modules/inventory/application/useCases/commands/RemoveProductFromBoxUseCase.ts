import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import {
  IInventoryBoxStockOutput,
  IRemoveProductFromBoxInput,
} from "@inventory/application/dto/InventoryBoxStockDTO";
import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

const boxStockInsufficient = () =>
  new BusinessRuleError("Quantidade maior que a alocada nesta caixa.", ErrorCodes.BOX_STOCK_INSUFFICIENT);

/**
 * Retira unidades de um lote de uma caixa (só a alocação; o saldo do lote e do
 * inventário não muda). Zerou → a alocação é apagada.
 */
export class RemoveProductFromBoxUseCase extends TransactionalUseCase<
  IRemoveProductFromBoxInput,
  IInventoryBoxStockOutput
> {
  constructor(
    private readonly inventoryBoxRepository: IInventoryBoxRepository,
    private readonly inventoryBoxStockRepository: IInventoryBoxStockRepository,
    private readonly inventoryLotRepository: IInventoryLotRepository,
    private readonly inventoryRepository: IInventoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(
    request: IRemoveProductFromBoxInput,
  ): Promise<IInventoryBoxStockOutput> {
    if (!Number.isSafeInteger(request.quantity) || request.quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    const box = await this.inventoryBoxRepository.findById(request.boxId);
    if (!box) {
      throw new NotFoundError("Caixa não encontrada.", ErrorCodes.BOX_NOT_FOUND);
    }

    const lot = await this.inventoryLotRepository.findById(request.inventoryLotId);
    if (!lot) {
      throw new NotFoundError("Lote não encontrado.", ErrorCodes.LOT_NOT_FOUND);
    }

    // Trava a variante do lote antes de ler a alocação: mesma ordem das saídas e
    // da reconciliação (inventário → lote → alocações).
    await this.inventoryRepository.lockExistingByProductVariantId(lot.productVariantId);

    const stock = await this.inventoryBoxStockRepository.findStock(lot.id, box.id);
    if (!stock || stock.quantity < request.quantity) {
      throw boxStockInsufficient();
    }

    stock.removeQuantity(request.quantity);

    if (stock.quantity === 0) {
      await this.inventoryBoxStockRepository.delete(stock.id);
      return { id: stock.id, boxId: stock.boxId, inventoryLotId: stock.inventoryLotId, quantity: 0 };
    }

    const data = await this.inventoryBoxStockRepository.update(stock);
    return {
      id: data.id,
      boxId: data.boxId,
      inventoryLotId: data.inventoryLotId,
      quantity: data.quantity,
    };
  }
}
