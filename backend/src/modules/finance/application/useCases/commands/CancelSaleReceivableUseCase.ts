import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { PaymentRepository } from "@finance/domain/repositories/PaymentRepository";
import { Payment } from "@finance/domain/entities/Payment";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes } from "@shared/domain/errors";

export const CHECKOUT_REFUND_REASON = "Venda cancelada";

export interface ICancelSaleReceivableInput {
  saleId: string;
  /** Usuário que cancela (fica como autor do estorno dos pagamentos do fechamento). */
  userId: string | null;
  /** false = passou a janela de estorno dos pagamentos feitos no fechamento da venda. */
  checkoutRefundAllowed: boolean;
}

/**
 * Cancela os documentos a receber da venda. Trava os documentos (FOR UPDATE, por id)
 * e decide sob a trava:
 * - pagamento ativo de parcela (não `atCheckout`) → 409 SALE_HAS_PAYMENTS;
 * - pagamento ativo do fechamento fora da janela → 409 CHECKOUT_REFUND_WINDOW_EXPIRED;
 * - senão estorna os pagamentos do fechamento ("Venda cancelada") e cancela os documentos.
 * Valida tudo antes de gravar qualquer coisa. Sem documento: nada a fazer.
 */
export class CancelSaleReceivableUseCase extends TransactionalUseCase<ICancelSaleReceivableInput, void> {
  constructor(
    private readonly documents: FinancialDocumentRepository,
    private readonly payments: PaymentRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ saleId, userId, checkoutRefundAllowed }: ICancelSaleReceivableInput): Promise<void> {
    const locked = await this.documents.lockByOrigin(FinancialType.RECEIVABLE, FinancialOriginType.SALE, saleId);
    if (locked.length === 0) return;

    const active = locked.flatMap((document) =>
      document.parcels.flatMap((parcel) =>
        parcel.payments.filter((p) => !p.isReversed).map((payment) => ({ document, payment })),
      ),
    );
    if (active.some(({ payment }) => !payment.atCheckout)) {
      throw new ConflictError("Venda com pagamentos registrados não pode ser cancelada.", ErrorCodes.SALE_HAS_PAYMENTS);
    }
    if (active.length > 0 && !checkoutRefundAllowed) {
      throw new ConflictError(
        "Venda paga no ato só pode ser cancelada com estorno em até 7 dias.",
        ErrorCodes.CHECKOUT_REFUND_WINDOW_EXPIRED,
      );
    }

    const reversed: Payment[] = active.map(({ document, payment }) =>
      document.reversePayment(payment.id, userId, CHECKOUT_REFUND_REASON),
    );
    for (const document of locked) document.cancel();

    for (const payment of reversed) await this.payments.saveReversal(payment);
    for (const document of locked) await this.documents.update(document);
  }
}
