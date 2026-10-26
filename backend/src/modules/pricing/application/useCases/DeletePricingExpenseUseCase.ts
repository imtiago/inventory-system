import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { PricingSettingsRepository } from "@pricing/application/contracts/PricingSettingsRepository";
import type { PriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";
import { expenseNotFound } from "./UpdatePricingExpenseUseCase";

export class DeletePricingExpenseUseCase extends TransactionalUseCase<{ id: string }, void> {
  constructor(
    private repository: PricingSettingsRepository,
    private trigger: PriceReviewTrigger,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ id }: { id: string }): Promise<void> {
    await this.repository.lockSettings();
    if (!(await this.repository.findExpense(id))) throw expenseNotFound();
    await this.repository.deleteExpense(id);
    await this.trigger.settingsChanged({ kind: "ALL" });
  }
}
