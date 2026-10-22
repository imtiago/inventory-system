import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";

export interface CreateFinancialServicenput {
  originId: string;
  customerId: string;
  originType: FinancialOriginType;
  totalAmount: number;
  parcels: [];
}

export interface FinancialService {
  createReceivable(
    input: CreateFinancialServicenput,
  ): Promise<void>;
}
