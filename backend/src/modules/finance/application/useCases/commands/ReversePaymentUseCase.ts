import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { PaymentRepository } from "@finance/domain/repositories/PaymentRepository";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { UseCase } from "@shared/domain/UseCase";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { FinancialDocumentDetailDTO } from "../../dto/FinancialDocumentReadDTO";
import { FinancialDocumentDetailReader } from "./RegisterPaymentUseCase";

export interface IReversePaymentInput {
  paymentId: string;
  reason: string;
  userId: string;
}

/**
 * Estorna um pagamento: descobre o documento da parcela, trava o documento
 * (FOR UPDATE) e relê sob a trava antes de validar e gravar. Pagamento de um
 * documento de outro tipo que não o da instância → 404 PAYMENT_NOT_FOUND.
 */
export class ReversePaymentUseCase<T extends FinancialType>
  implements UseCase<IReversePaymentInput, FinancialDocumentDetailDTO<T>>
{
  constructor(
    private readonly type: T,
    private readonly documents: FinancialDocumentRepository,
    private readonly payments: PaymentRepository,
    private readonly transactionManager: TransactionManager,
    private readonly detail: FinancialDocumentDetailReader<T>,
  ) {}

  async execute(input: IReversePaymentInput): Promise<FinancialDocumentDetailDTO<T>> {
    const documentId = await this.transactionManager.execute(async () => {
      const notFound = () => new NotFoundError("Pagamento não encontrado.", ErrorCodes.PAYMENT_NOT_FOUND);

      const documentId = await this.payments.findDocumentId(input.paymentId);
      if (!documentId) throw notFound();
      const document = await this.documents.lockById(documentId);
      if (!document || document.type !== this.type) throw notFound();

      const payment = document.reversePayment(input.paymentId, input.userId, input.reason);
      await this.payments.saveReversal(payment);
      await this.documents.update(document);
      return document.id;
    });

    return this.detail.execute(documentId);
  }
}
