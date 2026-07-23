// src/modules/receivables/application/useCases/CreateReceivable.ts

import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { FinancialParcelRepository } from "@finance/domain/repositories/FinancialParcelRepository";
import { Prisma } from "@prisma/client";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/domain/TransactionManager";

interface CreateReceivableRequest {
  originId: string;
  customerId: string;
  totalAmount: number;
  originType: FinancialOriginType;
  parcels: {
    amount: number;
    dueDate: Date;
  }[];
}
export class CreateReceivable extends TransactionalUseCase<
  CreateReceivableRequest,
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
    props: CreateReceivableRequest,
    transaction: Prisma.TransactionClient,
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

    await this.repo.create(document, transaction);
    await this.repositoryParcels.createMany(parcels, transaction);

    return document;
  }
}
