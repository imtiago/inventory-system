import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { InventoryService } from "@inventory/application/services/InventoryService";
import { FinancialService } from "@finance/application/services/FinancialService";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";
import { ICancelSaleInput } from "@sales/application/dto/SaleDTO";
import { Sale } from "@sales/domain/entities/Sale";
import { SaleCancelRequestRepository } from "@sales/domain/repositories/SaleCancelRequestRepository";
import { isWithinCheckoutRefundWindow } from "@sales/domain/services/checkoutRefundWindow";

/**
 * Cancela a venda numa transação: trava a linha da venda (cancelamentos
 * simultâneos → o segundo vê CANCELED e recebe 409) → valida status →
 * cancela o financeiro (409 SALE_HAS_PAYMENTS se houver pagamento de parcela;
 * pagamentos do fechamento são estornados até 7 dias da venda, depois 409
 * CHECKOUT_REFUND_WINDOW_EXPIRED) → devolve o estoque aos lotes de origem → venda CANCELED.
 */
export class CancelSaleUseCase extends TransactionalUseCase<ICancelSaleInput, Sale> {
  constructor(
    private readonly saleRepository: SaleRepository,
    transactionManager: TransactionManager,
    private readonly inventoryService: InventoryService,
    private readonly financialService: FinancialService,
    private readonly cancelRequests: SaleCancelRequestRepository,
    private readonly now: () => Date = () => new Date(),
  ) {
    super(transactionManager);
  }

  protected async handle({ id, userId }: ICancelSaleInput): Promise<Sale> {
    // Pedido pendente antes da venda: mesma ordem da aprovação (pedido → venda), sem ciclo.
    await this.cancelRequests.lockPendingBySaleId(id);
    const sale = await this.saleRepository.lockById(id);
    if (!sale) throw new NotFoundError("Venda não encontrada.", ErrorCodes.SALE_NOT_FOUND);

    // Lança ConflictError SALE_ALREADY_CANCELED antes de qualquer gravação.
    sale.cancel();

    await this.financialService.cancelSaleReceivable({
      saleId: sale.id,
      userId: userId ?? null,
      checkoutRefundAllowed: isWithinCheckoutRefundWindow(sale.createdAt, this.now()),
    });
    await this.inventoryService.returnSaleStock({
      saleId: sale.id,
      userId,
      items: sale.items.map((i) => ({ productVariantId: i.variantId, quantity: i.quantity })),
    });

    // Cancelamento direto (ou aprovação) fecha o pedido em aberto como APROVADO.
    await this.cancelRequests.approvePendingForSale(sale.id, userId);
    return this.saleRepository.update(sale);
  }
}
