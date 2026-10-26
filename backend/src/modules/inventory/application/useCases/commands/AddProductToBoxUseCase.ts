import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import {
  IAddProductToBoxInput,
  IInventoryBoxStockOutput,
} from "@inventory/application/dto/InventoryBoxStockDTO";
import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

export class AddProductToBoxUseCase extends TransactionalUseCase<
  IAddProductToBoxInput,
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
    request: IAddProductToBoxInput,
  ): Promise<IInventoryBoxStockOutput> {
    if (request.quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    const box = await this.inventoryBoxRepository.findById(request.boxId);

    if (!box) {
      throw new NotFoundError("Caixa não encontrada.", ErrorCodes.BOX_NOT_FOUND);
    }

    const found = await this.inventoryLotRepository.findById(
      request.inventoryLotId,
    );

    if (!found) {
      throw new NotFoundError("Lote não encontrado.", ErrorCodes.LOT_NOT_FOUND);
    }

    // Trava a variante do lote e relê o lote: saldo e alocações ficam estáveis
    // até o commit.
    const inventory = await this.inventoryRepository.lockExistingByProductVariantId(
      found.productVariantId,
    );
    const lot = inventory
      ? await this.inventoryLotRepository.findById(request.inventoryLotId)
      : null;

    if (!lot) {
      throw new NotFoundError("Lote não encontrado.", ErrorCodes.LOT_NOT_FOUND);
    }

    const allocated = await this.inventoryBoxStockRepository.sumAllocatedByLot(
      lot.id,
    );
    const available = Math.max(0, lot.remainingQuantity - allocated);

    if (request.quantity > available) {
      throw new BusinessRuleError(
        `Quantidade excede o saldo do lote disponível para caixas (${available}).`,
        ErrorCodes.BOX_LIMIT_EXCEEDED,
      );
    }

    const existingStock = await this.inventoryBoxStockRepository.findStock(
      request.inventoryLotId,
      request.boxId,
    );

    if (existingStock) {
      existingStock.addQuantity(request.quantity);
      return this.inventoryBoxStockRepository.update(existingStock);
    }

    const stock = new InventoryBoxStock({
      inventoryLotId: request.inventoryLotId,
      boxId: request.boxId,
      quantity: request.quantity,
    });

    const data = await this.inventoryBoxStockRepository.create(stock);
    return {
      id: data.id,
      boxId: data.boxId,
      inventoryLotId: data.inventoryLotId,
      quantity: data.quantity,
    };
  }
}
