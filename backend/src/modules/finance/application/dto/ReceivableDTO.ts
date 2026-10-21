import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";

export interface ICreateReceivableInput {
  originId: string;
  customerId: string;
  totalAmount: number;
  originType: FinancialOriginType;
  parcels: {
    amount: number;
    dueDate: Date;
  }[];
}
