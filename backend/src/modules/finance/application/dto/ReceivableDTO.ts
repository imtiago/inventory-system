import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";

export interface ICreateReceivableInput {
  /** Id do registro de origem (ex.: id da venda). */
  originId: string;
  originType: FinancialOriginType;
  customerId: string;
  parcels: {
    amount: number;
    dueDate: Date;
  }[];
}
