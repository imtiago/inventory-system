import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { FinancialService } from "@finance/application/services/FinancialService";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { purchaseNotFound } from "@purchases/domain/errors/purchaseErrors";
import { PurchaseRepository } from "@purchases/domain/repositories/PurchaseRepository";
import { ICancelPurchaseInput } from "../../dto/PurchaseDTO";

/**
 * Cancela o pedido numa transação. Ordem de trava: linha do pedido (FOR UPDATE)
 * → documento a pagar (a mesma do cancelamento de venda; o recebimento também
 * trava o pedido primeiro). Já cancelado / com recebimento → 409 antes de tocar
 * no financeiro; pagamento ativo → 409 PURCHASE_HAS_PAYMENTS (tudo desfeito).
 */
export class CancelPurchaseUseCase extends TransactionalUseCase<ICancelPurchaseInput, Purchase> {
  constructor(
    private readonly purchases: PurchaseRepository,
    transactionManager: TransactionManager,
    private readonly financialService: FinancialService,
  ) {
    super(transactionManager);
  }

  protected async handle({ id, reason, userId }: ICancelPurchaseInput): Promise<Purchase> {
    const purchase = await this.purchases.lockById(id);
    if (!purchase) throw purchaseNotFound();

    purchase.cancel({ reason, userId });

    await this.financialService.cancelPurchasePayable(purchase.id);

    return this.purchases.update(purchase);
  }
}
