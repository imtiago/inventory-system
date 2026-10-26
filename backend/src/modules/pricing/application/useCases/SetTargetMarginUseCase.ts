import type { Bps } from "@shared/domain/percent";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { assertPercentSum } from "@pricing/domain/pricingMath";
import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import type {
  PricingSettingsRepository,
  TargetMarginLevel,
} from "@pricing/application/contracts/PricingSettingsRepository";
import type { PriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";

export interface SetTargetMarginInput {
  level: TargetMarginLevel;
  id: string;
  marginBps: Bps | null;
}

const NOT_FOUND: Record<TargetMarginLevel, () => NotFoundError> = {
  category: () => new NotFoundError("Categoria não encontrada.", ErrorCodes.CATEGORY_NOT_FOUND),
  product: () => new NotFoundError("Produto não encontrado.", ErrorCodes.PRODUCT_NOT_FOUND),
  variant: () => new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND),
};

const SCOPE = { category: "CATEGORY", product: "PRODUCT", variant: "VARIANT" } as const;

export class SetTargetMarginUseCase extends TransactionalUseCase<SetTargetMarginInput, { marginBps: Bps | null }> {
  constructor(
    private repository: PricingSettingsRepository,
    private reader: PricingSettingsReader,
    private trigger: PriceReviewTrigger,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: SetTargetMarginInput): Promise<{ marginBps: Bps | null }> {
    await this.repository.lockSettings();
    if (input.marginBps !== null) {
      assertPercentSum((await this.reader.get()).expensesBps, input.marginBps);
    }
    const found = await this.repository.setTargetMargin(input.level, input.id, input.marginBps);
    if (!found) throw NOT_FOUND[input.level]();
    await this.trigger.settingsChanged({ kind: SCOPE[input.level], id: input.id });
    return { marginBps: input.marginBps };
  }
}
