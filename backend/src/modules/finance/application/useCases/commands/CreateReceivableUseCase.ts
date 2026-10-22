import { ICreateReceivableInput } from "@finance/application/dto/ReceivableDTO";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { FinancialParcelRepository } from "@finance/domain/repositories/FinancialParcelRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";

export class CreateReceivableUseCase extends TransactionalUseCase<
  ICreateReceivableInput,
  FinancialDocument
> {
  constructor(
    private repo: FinancialDocumentRepository,
    private repositoryParcels: FinancialParcelRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(
    props: ICreateReceivableInput,
  ) {
    const document = new FinancialDocument({
      type: FinancialType.RECEIVABLE,
      originId: props.originId,
      originType: props.originType,
      partyId: props.customerId,
      partyType: FinancialPartyType.CUSTOMER,
    });

    const parcels = props.parcels.map(
      (parcel) =>
        new FinancialParcel({
          amount: parcel.amount,
          dueDate: parcel.dueDate,
          financialDocumentId: document.id,
        }),
    );

    await this.repo.create(document);
    await this.repositoryParcels.createMany(parcels);

    return document;
  }
}
