import type { Bps } from "@shared/domain/percent";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { assertPercentSum } from "@pricing/domain/pricingMath";
import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import type { PricingSettingsRepository } from "@pricing/application/contracts/PricingSettingsRepository";
import type { PriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";
import { toExpenseDTO, type PricingExpenseDTO } from "@pricing/application/dto/PricingSettingsDTO";

export interface PricingExpenseInput {
  name: string;
  percentBps: Bps;
  active: boolean;
}

export class CreatePricingExpenseUseCase extends TransactionalUseCase<PricingExpenseInput, PricingExpenseDTO> {
  constructor(
    private repository: PricingSettingsRepository,
    private reader: PricingSettingsReader,
    private trigger: PriceReviewTrigger,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: PricingExpenseInput): Promise<PricingExpenseDTO> {
    await this.repository.lockSettings();
    if (input.active) {
      const s = await this.reader.get();
      assertPercentSum(s.expensesBps + input.percentBps, s.defaultMarginBps);
    }
    const created = await this.repository.createExpense(input);
    await this.trigger.settingsChanged({ kind: "ALL" });
    return toExpenseDTO(created);
  }
}
