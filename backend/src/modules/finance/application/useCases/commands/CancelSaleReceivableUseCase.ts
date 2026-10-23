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
 * Cancela todos os documentos a receber de uma venda (não há unicidade por
 * origem). Bloqueia (409 SALE_HAS_PAYMENTS) se houver qualquer pagamento em
 * qualquer um deles; venda sem documento não faz nada.
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
    // Trava antes de checar pagamentos: um pagamento concorrente que também
    // trave o documento fica serializado com este cancelamento.
    const documents = await this.documents.lockByOrigin(
      FinancialType.RECEIVABLE,
      FinancialOriginType.SALE,
      saleId,
    );
    if (documents.length === 0) return;

    if (await this.documents.hasPayments(documents.map((d) => d.id))) {
      throw new ConflictError(
        "Venda com pagamentos registrados não pode ser cancelada.",
        ErrorCodes.SALE_HAS_PAYMENTS,
      );
    }

    // Valida todos antes de gravar qualquer um.
    for (const document of documents) document.cancel();
    for (const document of documents) await this.documents.update(document);
  }
}
