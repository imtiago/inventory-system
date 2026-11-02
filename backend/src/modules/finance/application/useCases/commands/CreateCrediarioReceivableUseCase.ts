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

export interface ICreateCrediarioReceivableInput {
  saleId: string;
  customerId: string;
  /** Quem registrou a venda (autor do pagamento da entrada). */
  userId: string;
  /** Data de negócio "YYYY-MM-DD" (vencimento e pagamento da entrada). */
  today: string;
  /** Entrada paga no fechamento; null = sem entrada. */
  downPayment: { amountCents: number; method: PaymentMethod } | null;
  /** Parcelas do plano, vencimentos "YYYY-MM-DD". */
  parcels: { amountCents: number; dueDate: string }[];
}

/**
 * Contas a receber da venda no crediário: a entrada (se houver) vira uma parcela vencendo hoje, paga
 * `atCheckout` na mesma transação; depois as parcelas do plano. Documento PARTIALLY_PAID (com entrada)
 * ou OPEN.
 */
export class CreateCrediarioReceivableUseCase extends TransactionalUseCase<ICreateCrediarioReceivableInput, void> {
  constructor(
    private readonly documents: FinancialDocumentRepository,
    private readonly parcels: FinancialParcelRepository,
    private readonly payments: PaymentRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: ICreateCrediarioReceivableInput): Promise<void> {
    const document = new FinancialDocument({
      type: FinancialType.RECEIVABLE,
      originType: FinancialOriginType.SALE,
      originId: input.saleId,
      partyType: FinancialPartyType.CUSTOMER,
      partyId: input.customerId,
    });
    const newParcel = (amountCents: number, dueDate: string) => {
      const parcel = new FinancialParcel({ amountCents, dueDate, financialDocumentId: document.id });
      document.addParcel(parcel);
      return parcel;
    };

    const downParcel = input.downPayment ? newParcel(input.downPayment.amountCents, input.today) : null;
    const planParcels = input.parcels.map((p) => newParcel(p.amountCents, p.dueDate));
    const payment =
      downParcel && input.downPayment
        ? document.registerPayment({
            parcelId: downParcel.id,
            amountCents: input.downPayment.amountCents,
            method: input.downPayment.method,
            paymentDate: input.today,
            reference: null,
            createdById: input.userId,
            atCheckout: true,
          })
        : null;

    await this.documents.create(document);
    await this.parcels.createMany(downParcel ? [downParcel, ...planParcels] : planParcels);
    if (payment) {
      await this.payments.create(payment);
      await this.documents.update(document);
    }
  }
}
