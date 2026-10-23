import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { CreateReceivableUseCase } from "../useCases/commands/CreateReceivableUseCase";
import { CancelSaleReceivableUseCase } from "../useCases/commands/CancelSaleReceivableUseCase";
import { CreateSaleReceivableInput, FinancialService } from "./FinacialService";

export class FinancialApplicationService implements FinancialService {
  constructor(
    private readonly createReceivableUseCase: Pick<CreateReceivableUseCase, "execute">,
    private readonly cancelSaleReceivableUseCase: Pick<CancelSaleReceivableUseCase, "execute">,
  ) {}

  async createSaleReceivable(input: CreateSaleReceivableInput): Promise<void> {
    await this.createReceivableUseCase.execute({
      originType: FinancialOriginType.SALE,
      originId: input.saleId,
      customerId: input.customerId,
      parcels: input.parcels,
    });
  }

  async cancelSaleReceivable(saleId: string): Promise<void> {
    await this.cancelSaleReceivableUseCase.execute({ saleId });
  }
}
