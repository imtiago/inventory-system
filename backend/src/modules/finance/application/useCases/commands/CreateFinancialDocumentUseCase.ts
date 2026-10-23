import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { FinancialParcelRepository } from "@finance/domain/repositories/FinancialParcelRepository";
import { toDateOnly } from "@finance/domain/services/receivableStatus";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";

export interface ICreateFinancialDocumentInput {
  type: FinancialType;
  originType: FinancialOriginType;
  /** Id do registro de origem (venda, pedido de compra…). */
  originId: string;
  partyType: FinancialPartyType;
  partyId: string;
  /** Parcelas em centavos inteiros; vencimento à meia-noite UTC. */
  parcels: { amountCents: number; dueDate: Date }[];
}

/** Cria um documento (a receber ou a pagar) com as parcelas, na transação ativa. */
export class CreateFinancialDocumentUseCase extends TransactionalUseCase<
  ICreateFinancialDocumentInput,
  FinancialDocument
> {
  constructor(
    private readonly documents: FinancialDocumentRepository,
    private readonly parcels: FinancialParcelRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(props: ICreateFinancialDocumentInput): Promise<FinancialDocument> {
    const document = new FinancialDocument({
      type: props.type,
      originId: props.originId,
      originType: props.originType,
      partyId: props.partyId,
      partyType: props.partyType,
    });

    const parcels = props.parcels.map(
      (parcel) =>
        new FinancialParcel({
          amountCents: parcel.amountCents,
          dueDate: toDateOnly(parcel.dueDate),
          financialDocumentId: document.id,
        }),
    );

    await this.documents.create(document);
    await this.parcels.createMany(parcels);

    return document;
  }
}
