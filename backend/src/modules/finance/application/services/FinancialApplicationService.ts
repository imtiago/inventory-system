import { CreateReceivable } from "../useCases/commands/CreateReceivableUseCase";
import {
  CreateFinancialServicenput,
  FinancialService,
} from "./FinacialService";

export class FinancialApplicationService implements FinancialService {
  constructor(private readonly createReceivableUseCase: CreateReceivable) {}

  async createReceivable(
    input: CreateFinancialServicenput,
  ): Promise<void> {
    await this.createReceivableUseCase.execute(
      {
        customerId: input.customerId,
        originType: input.originType,
        parcels: input.parcels,
        originId: input.originId,
        totalAmount: input.totalAmount,
      }
    );
  }
}
