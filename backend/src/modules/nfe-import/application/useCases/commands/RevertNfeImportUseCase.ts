import { DomainError, ErrorCodes } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { FinancialService } from "@finance/application/services/FinacialService";
import { InventoryService } from "@inventory/application/services/InventoryService";
import { PurchaseStatus } from "@purchases/domain/enums/PurchaseStatus";
import { PurchaseRepository } from "@purchases/domain/repositories/PurchaseRepository";
import {
  NFE_REVERT_HAS_PAYMENTS,
  NFE_REVERT_STOCK_USED,
  nfeImportNotFound,
  nfeRevertBlocked,
} from "@nfe-import/domain/errors/nfeImportErrors";
import { NfeImportRepository } from "../../contracts/NfeImportRepository";

export interface RevertNfeImportInput {
  id: string;
  /** Usuário autenticado (movimentações de estoque e cancelamento do pedido). */
  userId: string;
}

/**
 * Desfaz uma importação de NF-e confirmada quando nada dela foi usado (spec §4 da onda 7), numa
 * transação só. Ordem das travas:
 *   importação (FOR UPDATE, como confirmação/descarte/reenvio) → pedido (FOR UPDATE, como
 *   recebimento/cancelamento) → inventário de cada variante em ordem crescente de productVariantId
 *   → lotes do pedido (ORDER BY id) → alocações em caixas → documento a pagar.
 * A mesma ordem relativa de todos os outros caminhos (venda: inventários → lotes → caixas;
 * cancelamento de pedido: pedido → documento; pagamento: documento), então não há ciclo.
 *
 * Bloqueios (409 NFE_REVERT_BLOCKED, nada gravado): importação não confirmada / pedido já
 * cancelado; algum lote do recebimento com saldo menor que o recebido (ou o saldo reservado);
 * pagamento ativo no contas a pagar.
 * Efeito: saída do estoque ("Estorno da NF-e <número>"), contas a pagar cancelado, pedido
 * cancelado (transição própria, `revertReceipts`) e importação REVERTED.
 */
export class RevertNfeImportUseCase extends TransactionalUseCase<RevertNfeImportInput, void> {
  constructor(
    private readonly imports: NfeImportRepository,
    private readonly purchases: PurchaseRepository,
    private readonly inventoryService: InventoryService,
    private readonly financialService: FinancialService,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ id, userId }: RevertNfeImportInput): Promise<void> {
    const locked = await this.imports.lockById(id);
    if (!locked) throw nfeImportNotFound();
    if (locked.status === "REVERTED") throw nfeRevertBlocked("Esta importação já foi desfeita.");
    if (locked.status !== "CONFIRMED" || !locked.purchaseId) {
      throw nfeRevertBlocked("Só é possível desfazer uma importação confirmada.");
    }

    const purchase = await this.purchases.lockById(locked.purchaseId);
    if (!purchase || purchase.status === PurchaseStatus.CANCELED) {
      throw nfeRevertBlocked("O pedido de compra desta nota já foi cancelado.");
    }
    const document = await this.imports.findDocument(id);
    if (!document) throw nfeImportNotFound();
    const reason = `Estorno da NF-e ${document.number}`;

    const stock = await this.inventoryService.revertPurchaseStock({
      purchaseId: purchase.id,
      productVariantIds: purchase.items.map((item) => item.productVariantId),
      notes: reason,
      userId,
    });
    if (stock === "STOCK_USED") throw nfeRevertBlocked(NFE_REVERT_STOCK_USED);

    // Último a travar. Pagamento ativo → a transação inteira (estoque incluso) é desfeita.
    await this.financialService.cancelPurchasePayable(purchase.id).catch((error: unknown) => {
      if (error instanceof DomainError && error.code === ErrorCodes.PURCHASE_HAS_PAYMENTS) {
        throw nfeRevertBlocked(NFE_REVERT_HAS_PAYMENTS);
      }
      throw error;
    });

    purchase.revertReceipts({ reason, userId });
    await this.purchases.update(purchase);
    await this.imports.markReverted(id);
  }
}
