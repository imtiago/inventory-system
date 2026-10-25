import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes } from "@shared/domain/errors";

/**
 * Movimentações da venda que não fecham (já devolvidas, saídas que não batem com os
 * itens, lote/estoque ausente ou estourado): 409 claro em vez de 500, sem gravar nada.
 */
const saleStockInconsistent = () =>
  new ConflictError(
    "Movimentações de estoque da venda inconsistentes; contate o administrador.",
    ErrorCodes.SALE_STOCK_INCONSISTENT,
  );

export interface IReturnSaleStockInput {
  saleId: string;
  /** Itens da venda: o total devolvido por variante tem de bater com eles. */
  items: { productVariantId: string; quantity: number }[];
  /** Usuário que cancelou (auditoria das movimentações RETURN). */
  userId?: string;
}

/**
 * Devolve ao estoque o que uma venda consumiu: para cada saída (OUT, origin SALE,
 * originId = venda) restaura o mesmo lote e registra uma entrada IN origin RETURN
 * com saldos encadeados, ao custo médio registrado na saída (restaura a média
 * ponderada; sem custo registrado → custo do lote). Trava as variantes em ordem crescente (mesma ordem da
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

  protected async handle({ saleId, userId, items }: IReturnSaleStockInput): Promise<StockMovement[]> {
    const alreadyReturned = await this.stockMovementRepository.findByOrigin(
      StockMovementOrigin.RETURN,
      saleId,
    );
    if (alreadyReturned.length > 0) {
      throw saleStockInconsistent();
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

    // Saídas rastreadas têm de cobrir exatamente os itens da venda (antes de gravar).
    const expected = new Map<string, number>();
    for (const item of items) {
      expected.set(item.productVariantId, (expected.get(item.productVariantId) ?? 0) + item.quantity);
    }
    const mismatch =
      expected.size !== byVariant.size ||
      [...expected].some(
        ([variantId, quantity]) =>
          (byVariant.get(variantId) ?? []).reduce((sum, m) => sum + m.quantity, 0) !== quantity,
      );
    if (mismatch) {
      throw saleStockInconsistent();
    }

    const created: StockMovement[] = [];
    for (const productVariantId of variantIds) {
      const inventory = await this.inventoryRepository.lockExistingByProductVariantId(productVariantId);
      if (!inventory) {
        throw saleStockInconsistent();
      }

      for (const out of byVariant.get(productVariantId)!) {
        const lot = out.inventoryLotId
          ? await this.inventoryLotRepository.findById(out.inventoryLotId)
          : null;
        if (!lot || lot.inventoryId !== inventory.id) {
          throw saleStockInconsistent();
        }

        // Estouro do lote é dado inconsistente (não regra de negócio do cliente).
        if (lot.remainingQuantity + out.quantity > lot.initialQuantity) {
          throw saleStockInconsistent();
        }

        const previousQuantity = inventory.quantity;
        lot.restore(out.quantity);
        inventory.receive({ quantity: out.quantity, unitCost: out.averageCost ?? lot.unitCost });
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
