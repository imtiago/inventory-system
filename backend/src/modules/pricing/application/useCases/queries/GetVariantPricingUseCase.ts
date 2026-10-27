import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { applyBps, bpsToPercent } from "@shared/domain/percent";
import { fromCents } from "@shared/domain/money";
import { resolveTargetMarginBps, suggestedPriceCents } from "@pricing/domain/pricingMath";
import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import type { TargetMarginReader } from "@pricing/application/contracts/TargetMarginReader";
import type { VariantPricingReader } from "@pricing/application/contracts/VariantPricingRepository";
import {
  buildMargin,
  buildSimulations,
  type TargetMarginSource,
  type VariantPricingDTO,
} from "@pricing/application/dto/VariantPricingDTO";

export class GetVariantPricingUseCase extends TransactionalUseCase<{ variantId: string }, VariantPricingDTO> {
  constructor(
    private variants: VariantPricingReader,
    private settings: PricingSettingsReader,
    private margins: TargetMarginReader,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ variantId }: { variantId: string }): Promise<VariantPricingDTO> {
    const source = await this.variants.find(variantId);
    if (!source) throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
    const settings = await this.settings.get();
    const levels = await this.margins.forVariant(variantId);

    const marginBps = resolveTargetMarginBps({ ...levels, store: settings.defaultMarginBps });
    const targetMarginSource: TargetMarginSource =
      levels.variant !== null ? "VARIANT" : levels.product !== null ? "PRODUCT" : levels.category !== null ? "CATEGORY" : "STORE";

    let suggestedCents: number | null = null;
    if (settings.configured && source.averageCost4 > 0) {
      try {
        suggestedCents = suggestedPriceCents({
          averageCost4: source.averageCost4,
          expensesBps: settings.expensesBps,
          marginBps,
          strategy: settings.roundingStrategy,
        });
      } catch (e) {
        // Despesas + margem ≥ 100% (configuração inconsistente): não há sugestão.
        if (!(e instanceof BusinessRuleError)) throw e;
      }
    }

    const common = { averageCost4: source.averageCost4, expensesBps: settings.expensesBps };
    return {
      variantId,
      averageCost: source.averageCost4 / 10_000,
      expensesPercent: bpsToPercent(settings.expensesBps),
      expensesAmount: fromCents(applyBps(source.salePriceCents, settings.expensesBps)),
      targetMarginPercent: bpsToPercent(marginBps),
      targetMarginSource,
      suggestedPrice: suggestedCents === null ? null : fromCents(suggestedCents),
      salePrice: fromCents(source.salePriceCents),
      realMargin: buildMargin({ ...common, priceCents: source.salePriceCents }),
      supplierSuggestedPrice: source.supplierPriceCents === null ? null : fromCents(source.supplierPriceCents),
      supplierSuggestedPriceUpdatedAt: source.supplierPriceUpdatedAt?.toISOString() ?? null,
      supplierMargin:
        source.supplierPriceCents === null ? null : buildMargin({ ...common, priceCents: source.supplierPriceCents }),
      simulations: buildSimulations({ ...common, salePriceCents: source.salePriceCents, cardFees: settings.cardFees }),
    };
  }
}
