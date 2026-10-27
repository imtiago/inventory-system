import { CatalogService } from "@catalog/application/services/CatalogService";
import {
  IReceiveInventoryInput,
  IReceiveInventoryOutput,
} from "@inventory/application/dto/InventoryDTO";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";
import type { PriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";

type CostTrigger = Pick<PriceReviewTrigger, "beforeCostChange" | "costChanged">;
const NO_PRICE_REVIEW: CostTrigger = { beforeCostChange: async () => {}, costChanged: async () => {} };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const formatDay = (d: Date) => {
  const [y, m, day] = dayKey(d).split("-");
  return `${day}/${m}/${y}`;
};

/** Entrada no mesmo lote: data informada diferente da do lote é recusada (não informada, não). */
function assertSameLotDates(lot: InventoryLot, request: IReceiveInventoryInput): void {
  const batch = lot.batchNumber;
  if (
    request.expirationDate &&
    lot.expirationDate &&
    dayKey(request.expirationDate) !== dayKey(lot.expirationDate)
  ) {
    throw new ConflictError(
      `O lote ${batch} já existe com validade ${formatDay(lot.expirationDate)}. Use outro número de lote ou a mesma validade.`,
      ErrorCodes.LOT_DATES_MISMATCH,
    );
  }
  if (
    request.manufacturingDate &&
    lot.manufacturingDate &&
    dayKey(request.manufacturingDate) !== dayKey(lot.manufacturingDate)
  ) {
    throw new ConflictError(
      `O lote ${batch} já existe com fabricação ${formatDay(lot.manufacturingDate)}. Use outro número de lote ou a mesma data de fabricação.`,
      ErrorCodes.LOT_DATES_MISMATCH,
    );
  }
}

export class ReceiveInventoryUseCase extends TransactionalUseCase<
  IReceiveInventoryInput,
  IReceiveInventoryOutput
> {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly inventoryLotRepository: IInventoryLotRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    transactionManager: TransactionManager,
    private readonly priceReviewTrigger: CostTrigger = NO_PRICE_REVIEW,
  ) {
    super(transactionManager);
  }

  protected async handle(
    request: IReceiveInventoryInput,
  ): Promise<IReceiveInventoryOutput> {
    const variant = await this.catalogService.getProductVariant(
      request.productVariantId,
    );
    if (!variant) {
      throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
    }

    // Trava compartilhada das configurações de preço ANTES de qualquer trava de estoque (ver PriceReviewService).
    await this.priceReviewTrigger.beforeCostChange();

    // Trava a linha da variante (criando o inventário vazio se faltar) antes de
    // qualquer leitura usada em cálculo; a variante já foi validada acima.
    const inventory = await this.inventoryRepository.lockByProductVariantId(
      request.productVariantId,
    );

    let lot = request.batchNumber
      ? await this.inventoryLotRepository.findByProductVariantIdAndBatchNumber(
          request.productVariantId,
          request.batchNumber,
        )
      : null;

    // Só soma num lote existente com o mesmo vínculo de compra: compra só no
    // lote do mesmo item do pedido; entrada sem item (manual, cadastro por
    // leitura) nunca num lote de compra. Misturaria custo e vínculo de origem.
    if (lot && lot.purchaseItemId !== (request.purchaseItemId ?? null)) {
      throw new ConflictError(
        "Já existe um lote com esse número para esta variante.",
        ErrorCodes.BATCH_ALREADY_EXISTS,
      );
    }

    if (lot) {
      assertSameLotDates(lot, request);
    }

    const previousQuantity = inventory.quantity;
    const previousAverageCost = inventory.averageCost;
    inventory.receive({
      quantity: request.quantity,
      unitCost: request.unitCost,
    });

    await this.inventoryRepository.update(inventory);

    if (lot) {
      lot.receive(request.quantity, {
        unitCost: request.unitCost,
        acquisitionExtraCost: request.acquisitionExtraCost,
        expirationDate: request.expirationDate,
        manufacturingDate: request.manufacturingDate,
      });
      await this.inventoryLotRepository.update(lot);
    } else {
      lot = new InventoryLot({
        inventoryId: inventory.id,
        productVariantId: request.productVariantId,
        sourceType: request.sourceType,
        sourceId: request.originReferenceId,
        purchaseItemId: request.purchaseItemId,
        initialQuantity: request.quantity,
        unitCost: request.unitCost,
        acquisitionExtraCost: request.acquisitionExtraCost,
        batchNumber: request.batchNumber,
        manufacturingDate: request.manufacturingDate,
        expirationDate: request.expirationDate,
      });
      await this.inventoryLotRepository.create(lot);
    }

    await this.stockMovementRepository.create(
      new StockMovement({
        inventoryId: inventory.id,
        inventoryLotId: lot.id,
        productVariantId: request.productVariantId,
        type: StockMovementType.IN,
        origin: request.origin,
        quantity: request.quantity,
        previousQuantity,
        currentQuantity: inventory.quantity,
        averageCost: inventory.averageCost,
        originId: request.originReferenceId,
        userId: request.userId,
        notes: request.notes,
      }),
    );

    // Custo médio mudou → revisão de preço, na mesma transação e depois das travas de inventário/lote
    // (a revisão é sempre a última trava; ver PriceReviewService).
    if (inventory.averageCost !== previousAverageCost) {
      await this.priceReviewTrigger.costChanged(request.productVariantId);
    }

    return { inventory, lot };
  }
}
