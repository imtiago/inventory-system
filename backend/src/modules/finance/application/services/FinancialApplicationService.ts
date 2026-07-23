import { CreateReceivable } from "../useCases/CreateReceivable";
import {
  CreateFinancialServicenput,
  FinancialService,
} from "./FinacialService";
import { Prisma } from "@prisma/client";

export class FinancialApplicationService implements FinancialService {
  constructor(private readonly createReceivableUseCase: CreateReceivable) {}

  async createReceivable(
    input: CreateFinancialServicenput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.createReceivableUseCase.execute(
      {
        customerId: input.customerId,
        originType: input.originType,
        parcels: input.parcels,
        originId: input.originId,
        totalAmount: input.totalAmount,
      },
      tx,
    );
  }
}
