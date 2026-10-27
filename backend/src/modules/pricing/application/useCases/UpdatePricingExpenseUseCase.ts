import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { assertPercentSum } from "@pricing/domain/pricingMath";
import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import type { PricingSettingsRepository } from "@pricing/application/contracts/PricingSettingsRepository";
import type { PriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";
import { toExpenseDTO, type PricingExpenseDTO } from "@pricing/application/dto/PricingSettingsDTO";
import type { PricingExpenseInput } from "./CreatePricingExpenseUseCase";

export const expenseNotFound = () =>
  new NotFoundError("Despesa não encontrada.", ErrorCodes.PRICING_EXPENSE_NOT_FOUND);

export class UpdatePricingExpenseUseCase extends TransactionalUseCase<
  PricingExpenseInput & { id: string; position?: number },
  PricingExpenseDTO
> {
  constructor(
    private repository: PricingSettingsRepository,
    private reader: PricingSettingsReader,
    private trigger: PriceReviewTrigger,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: PricingExpenseInput & { id: string; position?: number }): Promise<PricingExpenseDTO> {
    await this.repository.lockSettings();
    const current = await this.repository.findExpense(input.id);
    if (!current) throw expenseNotFound();
    if (input.active) {
      const s = await this.reader.get();
      const others = s.expensesBps - (current.active ? current.percentBps : 0);
      assertPercentSum(others + input.percentBps, Math.max(s.defaultMarginBps, await this.repository.maxLevelMarginBps()));
    }
    await this.repository.updateExpense(input.id, {
      name: input.name,
      percentBps: input.percentBps,
      active: input.active,
      position: input.position,
    });
    await this.trigger.settingsChanged({ kind: "ALL" });
    return toExpenseDTO({ ...current, name: input.name, percentBps: input.percentBps, active: input.active, position: input.position ?? current.position });
  }
}
