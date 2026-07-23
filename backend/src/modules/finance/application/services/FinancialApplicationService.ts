import { CreateReceivable } from "../useCases/CreateReceivable";
import { FinancialService } from "./FinacialService";

export class FinancialApplicationService implements FinancialService {
  constructor(private readonly createReceivableUseCase: CreateReceivable) {}

  async createReceivable(input: CreateReceivableInput): Promise<void> {
    await this.createReceivableUseCase.execute(input);
  }
}
