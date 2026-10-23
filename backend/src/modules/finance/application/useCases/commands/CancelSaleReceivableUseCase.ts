import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes } from "@shared/domain/errors";

export interface ICancelSaleReceivableInput {
  saleId: string;
}

/**
 * Cancela o documento a receber de uma venda. Bloqueia (409 SALE_HAS_PAYMENTS)
 * se houver qualquer pagamento registrado; venda sem documento não faz nada.
 */
export class CancelSaleReceivableUseCase extends TransactionalUseCase<
  ICancelSaleReceivableInput,
  void
> {
  constructor(
    private readonly documents: FinancialDocumentRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ saleId }: ICancelSaleReceivableInput): Promise<void> {
    const document = await this.documents.findByOrigin(
      FinancialType.RECEIVABLE,
      FinancialOriginType.SALE,
      saleId,
    );
    if (!document) return;

    if (await this.documents.hasPayments(document.id)) {
      throw new ConflictError(
        "Venda com pagamentos registrados não pode ser cancelada.",
        ErrorCodes.SALE_HAS_PAYMENTS,
      );
    }

    document.cancel();
    await this.documents.update(document);
  }
}
