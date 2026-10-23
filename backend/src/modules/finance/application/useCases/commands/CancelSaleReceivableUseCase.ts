import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes } from "@shared/domain/errors";
import { cancelOriginDocuments } from "./cancelOriginDocuments";

export interface ICancelSaleReceivableInput {
  saleId: string;
}

/** Cancela os documentos a receber da venda; pagamento ativo → 409 SALE_HAS_PAYMENTS. */
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
    await cancelOriginDocuments(
      this.documents,
      { type: FinancialType.RECEIVABLE, originType: FinancialOriginType.SALE, originId: saleId },
      () => new ConflictError("Venda com pagamentos registrados não pode ser cancelada.", ErrorCodes.SALE_HAS_PAYMENTS),
    );
  }
}
