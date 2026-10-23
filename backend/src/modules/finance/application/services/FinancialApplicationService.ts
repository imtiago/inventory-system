import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { CreateReceivableUseCase } from "../useCases/commands/CreateReceivableUseCase";
import { CreateSaleReceivableInput, FinancialService } from "./FinacialService";

export class FinancialApplicationService implements FinancialService {
  constructor(
    private readonly createReceivableUseCase: Pick<CreateReceivableUseCase, "execute">,
  ) {}

  async createSaleReceivable(input: CreateSaleReceivableInput): Promise<void> {
    await this.createReceivableUseCase.execute({
      originType: FinancialOriginType.SALE,
      originId: input.saleId,
      customerId: input.customerId,
      parcels: input.parcels,
    });
  }
}
