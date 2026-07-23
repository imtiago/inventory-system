import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { Prisma } from "@prisma/client";

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
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
