// src/modules/receivables/application/useCases/CreateReceivable.ts

import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";

export class CreateReceivable {
  constructor(
    private repo: FinancialDocumentRepository,
    private transaction: TransactionManager,
  ) {}

  async execute(props: {
    saleId: string;
    customerId: string;
    totalAmount: number;
    originType: FinancialOriginType;
    parcels: {
      amount: number;
      dueDate: Date;
    }[];
  }): Promise<FinancialDocument> {
    return this.transaction.execute(async (tx) => {
      const document = new FinancialDocument({
        type: FinancialType.RECEIVABLE,
        originId: props.saleId,
        originType: props.originType,
        partyId: props.customerId,
        partyType: FinancialPartyType.CUSTOMER,
      });

      const parcels: FinancialParcel[] = [];

      props.parcels.forEach((parcel) => {
        parcels.push(
          new FinancialParcel({
            amount: parcel.amount,
            dueDate: parcel.dueDate,
          }),
        );
      });

      return this.repo.create(document, tx);
    });
  }
}
