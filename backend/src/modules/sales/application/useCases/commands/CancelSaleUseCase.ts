import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { InventoryService } from "@inventory/application/services/InventoryService";
import { FinancialService } from "@finance/application/services/FinacialService";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";
import { ICancelSaleInput } from "@sales/application/dto/SaleDTO";
import { Sale } from "@sales/domain/entities/Sale";

/**
 * Cancela a venda numa transação: trava a linha da venda (cancelamentos
 * simultâneos → o segundo vê CANCELED e recebe 409) → valida status →
 * cancela o financeiro (409 se houver pagamento) → devolve o estoque aos
 * lotes de origem → venda CANCELED.
 */
export class CancelSaleUseCase extends TransactionalUseCase<ICancelSaleInput, Sale> {
  constructor(
    private readonly saleRepository: SaleRepository,
    transactionManager: TransactionManager,
    private readonly inventoryService: InventoryService,
    private readonly financialService: FinancialService,
  ) {
    super(transactionManager);
  }

  protected async handle({ id, userId }: ICancelSaleInput): Promise<Sale> {
    const sale = await this.saleRepository.lockById(id);
    if (!sale) throw new NotFoundError("Venda não encontrada.", ErrorCodes.SALE_NOT_FOUND);

    // Lança ConflictError SALE_ALREADY_CANCELED antes de qualquer gravação.
    sale.cancel();

    await this.financialService.cancelSaleReceivable(sale.id);
    await this.inventoryService.returnSaleStock({
      saleId: sale.id,
      userId,
      items: sale.items.map((i) => ({ productVariantId: i.variantId, quantity: i.quantity })),
    });

    return this.saleRepository.update(sale);
  }
}
