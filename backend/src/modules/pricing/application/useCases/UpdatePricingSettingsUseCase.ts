import type { Bps } from "@shared/domain/percent";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { CardFees } from "@pricing/domain/cardFees";
import type { RoundingStrategy } from "@pricing/domain/priceRounding";
import { assertPercentSum } from "@pricing/domain/pricingMath";
import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import type { PricingSettingsRepository } from "@pricing/application/contracts/PricingSettingsRepository";
import type { PriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";
import { toSettingsDTO, type PricingSettingsDTO } from "@pricing/application/dto/PricingSettingsDTO";

export interface UpdatePricingSettingsInput {
  defaultMarginBps: Bps;
  roundingStrategy: RoundingStrategy;
  alertThresholdBps: Bps;
  cardFees: CardFees;
  userId: string | null;
}

export class UpdatePricingSettingsUseCase extends TransactionalUseCase<UpdatePricingSettingsInput, PricingSettingsDTO> {
  constructor(
    private repository: PricingSettingsRepository,
    private reader: PricingSettingsReader,
    private trigger: PriceReviewTrigger,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: UpdatePricingSettingsInput): Promise<PricingSettingsDTO> {
    await this.repository.lockSettings();
    const current = await this.reader.get();
    assertPercentSum(current.expensesBps, Math.max(input.defaultMarginBps, await this.repository.maxLevelMarginBps()));
    await this.repository.saveSettings({
      defaultMarginBps: input.defaultMarginBps,
      roundingStrategy: input.roundingStrategy,
      alertThresholdBps: input.alertThresholdBps,
      cardFees: input.cardFees,
      updatedById: input.userId,
    });
    await this.trigger.settingsChanged({ kind: "ALL" });
    return toSettingsDTO(await this.reader.get(), await this.repository.listExpenses());
  }
}
