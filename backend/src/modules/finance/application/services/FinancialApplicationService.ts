import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { CreateReceivable } from "../useCases/CreateReceivable";
import { FinancialService } from "./FinacialService";

export class FinancialApplicationService implements FinancialService {
  constructor(private readonly createReceivableUseCase: CreateReceivable) {}

  async createReceivable(input: CreateReceivableInput): Promise<void> {
    await this.createReceivableUseCase.execute({
      ...input,
      customerId: "c449284f-cc53-494b-86a0-79ece4b4e9a1",
      originType: FinancialOriginType.SALE,
      totalAmount: 500,
      parcels: [],
    });
  }
}
