import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { toCents } from "@shared/domain/money";
import type { PricingSettingsRepository } from "@pricing/application/contracts/PricingSettingsRepository";
import type { PriceReviewRepository } from "@pricing/application/contracts/PriceReviewRepository";
import type { VariantPricingWriter } from "@pricing/application/contracts/VariantPricingRepository";
import type { ApplyPriceReviewsResultDTO } from "@pricing/application/dto/PriceReviewDTO";
import type { GetVariantPricingUseCase } from "@pricing/application/useCases/queries/GetVariantPricingUseCase";
import { priceReviewNotFound } from "./DismissPriceReviewUseCase";

/**
 * Aplica o sugerido RECALCULADO AGORA (não o gravado na revisão) e marca APPLIED.
 *
 * Travas: configurações (compartilhada) → variantes (id crescente) → revisões (variante, id).
 * Mesma ordem variante → revisão de "editar preço"/"aplicar sugerido" na variante (que resolvem a pendente
 * dela); a ordem revisões → variantes criaria ciclo com eles. A trava compartilhada vem antes das variantes
 * porque a margem-alvo por variante trava a variante depois da exclusiva das configurações.
 */
export class ApplyPriceReviewsUseCase extends TransactionalUseCase<{ ids: string[]; userId: string }, ApplyPriceReviewsResultDTO> {
  constructor(
    private reviews: PriceReviewRepository,
    private settingsLock: Pick<PricingSettingsRepository, "lockSettingsShared">,
    private writer: VariantPricingWriter,
    private pricing: GetVariantPricingUseCase,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: { ids: string[]; userId: string }): Promise<ApplyPriceReviewsResultDTO> {
    const ids = [...new Set(input.ids)];
    await this.settingsLock.lockSettingsShared();
    const found = await this.reviews.findByIds(ids);
    if (found.length !== ids.length) throw priceReviewNotFound();

    const variantIds = [...new Set(found.map((r) => r.productVariantId))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const variantId of variantIds) await this.writer.lockVariant(variantId);

    const applied: string[] = [];
    const skipped: string[] = [];
    for (const review of await this.reviews.lockByIds(ids)) {
      if (review.status !== "PENDING") {
        skipped.push(review.id);
        continue;
      }
      const now = await this.pricing.execute({ variantId: review.productVariantId });
      if (now.suggestedPrice === null) {
        skipped.push(review.id);
        continue;
      }
      if (toCents(now.suggestedPrice) !== toCents(now.salePrice)) {
        await this.writer.setSalePrice(review.productVariantId, toCents(now.suggestedPrice));
      }
      applied.push(review.id);
    }
    await this.reviews.resolve(applied, "APPLIED", input.userId);
    return { applied, skipped };
  }
}
