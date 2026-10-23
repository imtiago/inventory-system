import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes } from "@shared/domain/errors";
import { cancelOriginDocuments } from "./cancelOriginDocuments";

export interface ICancelPurchasePayableInput {
  purchaseId: string;
}

/** Cancela os documentos a pagar do pedido; pagamento ativo → 409 PURCHASE_HAS_PAYMENTS. */
export class CancelPurchasePayableUseCase extends TransactionalUseCase<
  ICancelPurchasePayableInput,
  void
> {
  constructor(
    private readonly documents: FinancialDocumentRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ purchaseId }: ICancelPurchasePayableInput): Promise<void> {
    await cancelOriginDocuments(
      this.documents,
      { type: FinancialType.PAYABLE, originType: FinancialOriginType.PURCHASE, originId: purchaseId },
      () =>
        new ConflictError(
          "Pedido com pagamentos registrados não pode ser cancelado.",
          ErrorCodes.PURCHASE_HAS_PAYMENTS,
        ),
    );
  }
}
