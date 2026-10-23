import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";

export interface IReturnSaleStockInput {
  saleId: string;
  /** Usuário que cancelou (auditoria das movimentações RETURN). */
  userId?: string;
}

/**
 * Devolve ao estoque o que uma venda consumiu: para cada saída (OUT, origin SALE,
 * originId = venda) restaura o mesmo lote e registra uma entrada IN origin RETURN
 * com saldos encadeados. Trava as variantes em ordem crescente (mesma ordem da
 * criação da venda → sem deadlock).
 */
export class ReturnSaleStockUseCase extends TransactionalUseCase<
  IReturnSaleStockInput,
  StockMovement[]
> {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly inventoryLotRepository: IInventoryLotRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ saleId, userId }: IReturnSaleStockInput): Promise<StockMovement[]> {
    const alreadyReturned = await this.stockMovementRepository.findByOrigin(
      StockMovementOrigin.RETURN,
      saleId,
    );
    if (alreadyReturned.length > 0) {
      throw new InternalInvariantError(
        "O estoque desta venda já foi devolvido.",
        InternalErrorCodes.SALE_STOCK_ALREADY_RETURNED,
      );
    }

    const outs = (
      await this.stockMovementRepository.findByOrigin(StockMovementOrigin.SALE, saleId)
    ).filter((m) => m.type === StockMovementType.OUT);

    const byVariant = new Map<string, StockMovement[]>();
    for (const out of outs) {
      const list = byVariant.get(out.productVariantId) ?? [];
      list.push(out);
      byVariant.set(out.productVariantId, list);
    }
    const variantIds = [...byVariant.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const created: StockMovement[] = [];
    for (const productVariantId of variantIds) {
      const inventory = await this.inventoryRepository.lockExistingByProductVariantId(productVariantId);
      if (!inventory) {
        throw new InternalInvariantError(
          "Estoque da venda não encontrado para devolução.",
          InternalErrorCodes.INVENTORY_LOTS_INCONSISTENT,
        );
      }

      for (const out of byVariant.get(productVariantId)!) {
        const lot = out.inventoryLotId
          ? await this.inventoryLotRepository.findById(out.inventoryLotId)
          : null;
        if (!lot || lot.inventoryId !== inventory.id) {
          throw new InternalInvariantError(
            "Lote da saída da venda não encontrado para devolução.",
            InternalErrorCodes.INVENTORY_LOTS_INCONSISTENT,
          );
        }

        const previousQuantity = inventory.quantity;
        lot.restore(out.quantity);
        inventory.receive({ quantity: out.quantity, unitCost: lot.unitCost });
        await this.inventoryLotRepository.update(lot);

        const movement = new StockMovement({
          inventoryId: inventory.id,
          inventoryLotId: lot.id,
          productVariantId,
          type: StockMovementType.IN,
          origin: StockMovementOrigin.RETURN,
          quantity: out.quantity,
          previousQuantity,
          currentQuantity: inventory.quantity,
          averageCost: inventory.averageCost,
          originId: saleId,
          userId,
        });
        await this.stockMovementRepository.create(movement);
        created.push(movement);
      }

      await this.inventoryRepository.update(inventory);
    }

    return created;
  }
}
