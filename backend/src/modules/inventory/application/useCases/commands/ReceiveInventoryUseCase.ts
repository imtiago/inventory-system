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

    const previousQuantity = inventory.quantity;
    inventory.receive({
      quantity: request.quantity,
      unitCost: request.unitCost,
    });

    await this.inventoryRepository.update(inventory);

    if (lot) {
      lot.receive(request.quantity);
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

    return { inventory, lot };
  }
}
