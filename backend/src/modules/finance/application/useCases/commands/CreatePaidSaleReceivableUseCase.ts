import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { FinancialParcelRepository } from "@finance/domain/repositories/FinancialParcelRepository";
import { PaymentRepository } from "@finance/domain/repositories/PaymentRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";

export interface ICreatePaidSaleReceivableInput {
  saleId: string;
  customerId: string;
  /** Valor pago no fechamento, em centavos. */
  amountCents: number;
  method: PaymentMethod;
  /** Quem registrou a venda. */
  userId: string;
  /** Data de negócio "YYYY-MM-DD" (vencimento e data do pagamento). */
  today: string;
}

/**
 * Venda paga no ato: documento a receber com uma parcela vencendo hoje e o pagamento
 * `atCheckout` registrado na mesma transação (documento PAID, nada em aberto).
 */
export class CreatePaidSaleReceivableUseCase extends TransactionalUseCase<ICreatePaidSaleReceivableInput, void> {
  constructor(
    private readonly documents: FinancialDocumentRepository,
    private readonly parcels: FinancialParcelRepository,
    private readonly payments: PaymentRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: ICreatePaidSaleReceivableInput): Promise<void> {
    const document = new FinancialDocument({
      type: FinancialType.RECEIVABLE,
      originType: FinancialOriginType.SALE,
      originId: input.saleId,
      partyType: FinancialPartyType.CUSTOMER,
      partyId: input.customerId,
    });
    const parcel = new FinancialParcel({
      amountCents: input.amountCents,
      dueDate: input.today,
      financialDocumentId: document.id,
    });
    document.addParcel(parcel);
    const payment = document.registerPayment({
      parcelId: parcel.id,
      amountCents: input.amountCents,
      method: input.method,
      paymentDate: input.today,
      reference: null,
      createdById: input.userId,
      atCheckout: true,
    });

    await this.documents.create(document);
    await this.parcels.createMany([parcel]);
    await this.payments.create(payment);
    await this.documents.update(document);
  }
}
