import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { InventoryService } from "@inventory/application/services/InventoryService";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { purchaseNotFound } from "@purchases/domain/errors/purchaseErrors";
import { PurchaseRepository } from "@purchases/domain/repositories/PurchaseRepository";
import { IReceivePurchaseInput } from "../../dto/PurchaseDTO";

const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00.000Z`) : undefined);

/**
 * Recebe itens do pedido numa transação. Ordem de trava: linha do pedido
 * (FOR UPDATE, a mesma do cancelamento — serializa recebimento × cancelamento e
 * recebimento × recebimento) → inventário de cada variante em ordem crescente
 * de productVariantId (mesma ordem das vendas, sem deadlock). Status e saldos
 * são validados no agregado antes de qualquer entrada de estoque.
 */
export class ReceivePurchaseUseCase extends TransactionalUseCase<IReceivePurchaseInput, Purchase> {
  constructor(
    private readonly purchases: PurchaseRepository,
    transactionManager: TransactionManager,
    private readonly inventoryService: InventoryService,
  ) {
    super(transactionManager);
  }

  protected async handle({ id, items, userId }: IReceivePurchaseInput): Promise<Purchase> {
    const purchase = await this.purchases.lockById(id);
    if (!purchase) throw purchaseNotFound();

    purchase.receive(items.map(({ purchaseItemId, quantity }) => ({ purchaseItemId, quantity })));

    const byId = new Map(purchase.items.map((item) => [item.id, item]));
    const inLockOrder = items
      .map((line) => ({ line, item: byId.get(line.purchaseItemId)! }))
      .sort((a, b) =>
        a.item.productVariantId < b.item.productVariantId ? -1 : a.item.productVariantId > b.item.productVariantId ? 1 : 0,
      );

    for (const { line, item } of inLockOrder) {
      await this.inventoryService.receivePurchaseStock({
        purchaseId: purchase.id,
        purchaseItemId: item.id,
        productVariantId: item.productVariantId,
        quantity: line.quantity,
        unitCost: item.unitCost,
        batchNumber: line.batchNumber,
        manufacturingDate: toDate(line.manufacturingDate),
        expirationDate: toDate(line.expirationDate),
        userId,
      });
    }

    return this.purchases.update(purchase);
  }
}
