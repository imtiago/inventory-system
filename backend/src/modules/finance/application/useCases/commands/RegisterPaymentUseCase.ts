import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { PaymentRepository } from "@finance/domain/repositories/PaymentRepository";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { UseCase } from "@shared/domain/UseCase";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { toCents } from "@shared/domain/money";
import { ErrorCodes, NotFoundError, ValidationError } from "@shared/domain/errors";
import { ReceivableDetailDTO } from "../../dto/ReceivableReadDTO";

export interface IRegisterPaymentInput {
  documentId: string;
  parcelId: string;
  /** Valor monetário (até 2 casas). */
  amount: number;
  method: PaymentMethod;
  /** "YYYY-MM-DD"; padrão = hoje (negócio). */
  paymentDate?: string;
  reference?: string | null;
  userId: string;
}

/** Monta a resposta (detalhe da conta a receber) depois do commit. */
export interface ReceivableDetailReader {
  execute(id: string): Promise<ReceivableDetailDTO>;
}

/**
 * Registra um pagamento numa parcela. Trava o documento (FOR UPDATE, mesma
 * linha travada pelo cancelamento da venda) e valida sob a trava: pagamentos
 * concorrentes e cancelamento ficam serializados.
 */
export class RegisterPaymentUseCase implements UseCase<IRegisterPaymentInput, ReceivableDetailDTO> {
  constructor(
    private readonly documents: FinancialDocumentRepository,
    private readonly payments: PaymentRepository,
    private readonly transactionManager: TransactionManager,
    private readonly detail: ReceivableDetailReader,
    private readonly today: () => string = () => todayInBusinessTz(),
  ) {}

  async execute(input: IRegisterPaymentInput): Promise<ReceivableDetailDTO> {
    const today = this.today();
    const paymentDate = input.paymentDate ?? today;
    if (paymentDate > today) {
      throw new ValidationError("Dados inválidos.", [
        { field: "paymentDate", message: "A data do pagamento não pode ser futura." },
      ]);
    }
    const reference = input.reference?.trim() || null;
    const amountCents = toCents(input.amount);

    await this.transactionManager.execute(async () => {
      const document = await this.documents.lockById(input.documentId);
      if (!document || document.type !== FinancialType.RECEIVABLE) {
        throw new NotFoundError("Conta a receber não encontrada.", ErrorCodes.FINANCIAL_DOCUMENT_NOT_FOUND);
      }
      const payment = document.registerPayment({
        parcelId: input.parcelId,
        amountCents,
        method: input.method,
        paymentDate,
        reference,
        createdById: input.userId,
      });
      await this.payments.create(payment);
      await this.documents.update(document);
    });

    return this.detail.execute(input.documentId);
  }
}
