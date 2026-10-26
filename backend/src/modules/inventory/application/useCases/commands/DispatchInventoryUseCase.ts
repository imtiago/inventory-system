import { IDispatchInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { businessTodayAsUtcDate } from "@shared/domain/businessDate";
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ErrorCodes,
  InternalErrorCodes,
  InternalInvariantError,
  NotFoundError,
} from "@shared/domain/errors";

type Consumption = { lot: InventoryLot; quantity: number };

export class DispatchInventoryUseCase extends TransactionalUseCase<
  IDispatchInventoryInput,
  StockMovement[]
> {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly inventoryLotRepository: IInventoryLotRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    private readonly inventoryBoxStockRepository: Pick<
      IInventoryBoxStockRepository,
      "reconcileBoxAllocations"
    >,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(
    request: IDispatchInventoryInput,
  ): Promise<StockMovement[]> {
    // Trava a linha da variante antes de ler saldo/lotes (sem criar inventário).
    const inventory = await this.inventoryRepository.lockExistingByProductVariantId(
      request.productVariantId,
    );
    if (!inventory) {
      throw new NotFoundError("Estoque não encontrado.", ErrorCodes.INVENTORY_NOT_FOUND);
    }

    const consumptions = await this.planConsumptions(inventory, request);

    await this.inventoryRepository.update(inventory);

    const movements: StockMovement[] = [];
    let balance = inventory.quantity + request.quantity;
    for (const { lot, quantity } of consumptions) {
      await this.inventoryLotRepository.update(lot);
      const movement = new StockMovement({
        inventoryId: inventory.id,
        inventoryLotId: lot.id,
        productVariantId: request.productVariantId,
        type: StockMovementType.OUT,
        origin: request.origin,
        quantity,
        previousQuantity: balance,
        currentQuantity: balance - quantity,
        averageCost: inventory.averageCost,
        originId: request.originReferenceId,
        userId: request.userId,
        notes: request.notes,
      });
      balance -= quantity;
      await this.stockMovementRepository.create(movement);
      movements.push(movement);
    }

    // Saldo dos lotes caiu: alocações em caixas não podem passar dele.
    await this.inventoryBoxStockRepository.reconcileBoxAllocations(
      consumptions.map(({ lot }) => lot.id),
    );

    return movements;
  }

  /**
   * Escolhe os lotes (e valida o disponível) antes de qualquer gravação.
   * - com `inventoryLotId`: só aquele lote (saída manual; vencido pode);
   * - venda: só lotes não vencidos, FEFO; falta coberta só por vencidos → 409 EXPIRED_STOCK_ONLY;
   * - demais: todos os lotes em FEFO (vencidos saem primeiro).
   */
  private async planConsumptions(
    inventory: Inventory,
    request: IDispatchInventoryInput,
  ): Promise<Consumption[]> {
    if (request.inventoryLotId) {
      const lot = await this.inventoryLotRepository.findById(request.inventoryLotId);
      if (!lot || lot.inventoryId !== inventory.id) {
        throw new NotFoundError("Lote não encontrado neste estoque.", ErrorCodes.LOT_NOT_FOUND);
      }
      inventory.dispatch(request.quantity);
      lot.consume(request.quantity);
      return [{ lot, quantity: request.quantity }];
    }

    const allLots = await this.inventoryLotRepository.findAvailableByInventory(inventory.id);
    const isSale = request.origin === StockMovementOrigin.SALE;
    const today = businessTodayAsUtcDate();
    const lots = isSale ? allLots.filter((lot) => !lot.isExpired(today)) : allLots;

    if (isSale) {
      const validTotal = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
      const expiredTotal = allLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0) - validTotal;
      const details = (available: number) => ({
        productVariantId: request.productVariantId,
        available,
        expired: expiredTotal,
      });
      try {
        inventory.dispatch(request.quantity);
      } catch (error) {
        if (error instanceof DomainError && error.code === ErrorCodes.INSUFFICIENT_STOCK) {
          throw new BusinessRuleError(
            error.message,
            ErrorCodes.INSUFFICIENT_STOCK,
            details(Math.max(0, Math.min(validTotal, inventory.availableQuantity))),
          );
        }
        throw error;
      }
      // Falta coberta por vencidos. (Lotes somando menos que o estoque =
      // inconsistência: cai no invariante abaixo.)
      if (validTotal < request.quantity && validTotal + expiredTotal >= request.quantity) {
        throw new ConflictError(
          "Estoque disponível apenas em lotes vencidos.",
          ErrorCodes.EXPIRED_STOCK_ONLY,
          details(validTotal),
        );
      }
    } else {
      inventory.dispatch(request.quantity);
    }

    const consumptions: Consumption[] = [];
    let remaining = request.quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, lot.remainingQuantity);
      lot.consume(quantity);
      consumptions.push({ lot, quantity });
      remaining -= quantity;
    }
    if (remaining > 0) {
      throw new InternalInvariantError("Os lotes do estoque estão inconsistentes.", InternalErrorCodes.INVENTORY_LOTS_INCONSISTENT);
    }
    return consumptions;
  }
}
