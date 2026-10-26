import { Inventory } from "@inventory/domain/entities/Inventory";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { roundCost } from "@shared/domain/money";

export interface RevertPurchaseStockInput {
  purchaseId: string;
  /** Variantes dos itens do pedido (travadas em ordem crescente, como nas vendas e no recebimento). */
  productVariantIds: readonly string[];
  /** Nota das movimentações de saída (ex.: "Estorno da NF-e 12345"). */
  notes: string;
  userId: string;
}

/** REVERTED: tudo estornado; STOCK_USED: algum lote do pedido já teve saída (ou o saldo está reservado) — nada foi gravado. */
export type RevertPurchaseStockResult = { status: "REVERTED"; lots: number } | { status: "STOCK_USED" };


/**
 * Estorna a entrada de estoque de um pedido de compra (importação de NF-e desfeita), só se nada
 * dela foi usado. Ordem das travas: inventário de cada variante em ordem crescente de
 * productVariantId (a mesma das vendas e do recebimento) → lotes do pedido (ORDER BY id) →
 * alocações em caixas (reconcileBoxAllocations). Uma venda concorrente trava o mesmo inventário:
 * uma das duas espera a outra e vê o resultado (lote consumido, ou estoque insuficiente).
 *
 * Condições (lidas sob as travas): cada lote com saldo = quantidade recebida, e o disponível
 * (saldo − reservado) do inventário cobre o que sai. Efeito: lote zerado (mantido como histórico),
 * saída OUT origem PURCHASE por lote, alocações removidas e custo médio revertido (inverso da média
 * móvel do recebimento; sem estoque → 0).
 */
export class RevertPurchaseStockUseCase extends TransactionalUseCase<RevertPurchaseStockInput, RevertPurchaseStockResult> {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly inventoryLotRepository: IInventoryLotRepository,
    private readonly stockMovementRepository: IStockMovementRepository,
    private readonly inventoryBoxStockRepository: Pick<IInventoryBoxStockRepository, "reconcileBoxAllocations">,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: RevertPurchaseStockInput): Promise<RevertPurchaseStockResult> {
    const variantIds = [...new Set(input.productVariantIds)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const inventories = new Map<string, Inventory>();
    for (const productVariantId of variantIds) {
      const inventory = await this.inventoryRepository.lockExistingByProductVariantId(productVariantId);
      if (inventory) inventories.set(inventory.id, inventory);
    }

    const lots = await this.inventoryLotRepository.lockByPurchase(input.purchaseId);
    if (lots.length === 0) return { status: "REVERTED", lots: 0 };

    const lotsByInventory = new Map<string, InventoryLot[]>();
    for (const lot of lots) {
      if (!inventories.has(lot.inventoryId)) {
        throw new InternalInvariantError("Lote do pedido fora das variantes do pedido.", InternalErrorCodes.INVENTORY_LOTS_INCONSISTENT);
      }
      if (lot.remainingQuantity !== lot.initialQuantity) return { status: "STOCK_USED" };
      lotsByInventory.set(lot.inventoryId, [...(lotsByInventory.get(lot.inventoryId) ?? []), lot]);
    }
    const outOf = (inventoryLots: InventoryLot[]) => inventoryLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
    for (const [inventoryId, inventoryLots] of lotsByInventory) {
      if (!inventories.get(inventoryId)!.hasAvailableStock(outOf(inventoryLots))) return { status: "STOCK_USED" };
    }

    // Validado tudo: grava, inventário por inventário, na ordem das travas.
    for (const inventory of inventories.values()) {
      const inventoryLots = lotsByInventory.get(inventory.id);
      if (!inventoryLots) continue;
      const quantity = outOf(inventoryLots);
      const consumed = inventoryLots.map((lot) => ({ lot, quantity: lot.remainingQuantity }));
      for (const { lot, quantity: lotQuantity } of consumed) {
        lot.consume(lotQuantity);
        await this.inventoryLotRepository.update(lot);
      }

      // Desfaz a média móvel da entrada: (média·saldo − Σ custo·qtd dos lotes) / (saldo − qtd). Só se
      // o saldo do inventário bater com os lotes cai no recálculo pelos lotes que restam (dados
      // desalinhados: resultado negativo/inválido).
      const removedValue = consumed.reduce((sum, { lot, quantity: lotQuantity }) => sum + lotQuantity * lot.unitCost, 0);
      const remainingStock = inventory.quantity - quantity;
      let averageCost = 0;
      if (remainingStock > 0) {
        averageCost = roundCost((inventory.averageCost * inventory.quantity - removedValue) / remainingStock);
        if (!Number.isFinite(averageCost) || averageCost < 0) {
          const remaining = await this.inventoryLotRepository.findAvailableByInventory(inventory.id);
          const remainingQuantity = remaining.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
          averageCost =
            remainingQuantity === 0
              ? 0
              : roundCost(remaining.reduce((sum, lot) => sum + lot.remainingQuantity * lot.unitCost, 0) / remainingQuantity);
        }
      }

      let balance = inventory.quantity;
      inventory.revertReceipt(quantity, averageCost);
      await this.inventoryRepository.update(inventory);

      for (const { lot, quantity: lotQuantity } of consumed) {
        await this.stockMovementRepository.create(
          new StockMovement({
            inventoryId: inventory.id,
            inventoryLotId: lot.id,
            productVariantId: inventory.productVariantId,
            type: StockMovementType.OUT,
            origin: StockMovementOrigin.PURCHASE,
            quantity: lotQuantity,
            previousQuantity: balance,
            currentQuantity: balance - lotQuantity,
            averageCost: inventory.averageCost,
            originId: input.purchaseId,
            userId: input.userId,
            notes: input.notes,
          }),
        );
        balance -= lotQuantity;
      }
    }

    // Lotes zerados: as alocações em caixas saem junto.
    await this.inventoryBoxStockRepository.reconcileBoxAllocations(lots.map((lot) => lot.id));

    return { status: "REVERTED", lots: lots.length };
  }
}
