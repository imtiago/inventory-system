import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { PricingSettingsRepository } from "@pricing/application/contracts/PricingSettingsRepository";
import type { PriceReviewRepository } from "@pricing/application/contracts/PriceReviewRepository";
import type { VariantPricingWriter } from "@pricing/application/contracts/VariantPricingRepository";
import type { ApplyPriceReviewsResultDTO } from "@pricing/application/dto/PriceReviewDTO";
import { BusinessRuleError } from "@shared/domain/errors";
import { resolveTargetMarginBps, suggestedPriceCents } from "@pricing/domain/pricingMath";
import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import type { TargetMarginReader } from "@pricing/application/contracts/TargetMarginReader";
import type { VariantPricingReader } from "@pricing/application/contracts/VariantPricingRepository";

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
    private variants: VariantPricingReader,
    // Só margens/despesas: as taxas de cartão não entram na conta (JSON inválido não derruba o lote).
    private settings: Pick<PricingSettingsReader, "getMarginSettings">,
    private margins: TargetMarginReader,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: { ids: string[]; userId: string }): Promise<ApplyPriceReviewsResultDTO> {
    const ids = [...new Set(input.ids)];
    await this.settingsLock.lockSettingsShared();
    const found = await this.reviews.findByIds(ids);

    const variantIds = [...new Set(found.map((r) => r.productVariantId))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const variantId of variantIds) await this.writer.lockVariant(variantId);

    const applied: string[] = [];
    const skippedDetails: ApplyPriceReviewsResultDTO["skippedDetails"] = [];
    const seen = new Set<string>();
    for (const review of await this.reviews.lockByIds(ids)) {
      seen.add(review.id);
      if (review.status !== "PENDING") {
        skippedDetails.push({ id: review.id, reason: "NOT_PENDING" });
        continue;
      }
      const now = await this.suggestNow(review.productVariantId);
      if (now === null) {
        skippedDetails.push({ id: review.id, reason: "NO_SUGGESTION" });
        continue;
      }
      if (now.suggestedCents !== now.salePriceCents) await this.writer.setSalePrice(review.productVariantId, now.suggestedCents);
      applied.push(review.id);
    }
    // Sumiram (um gatilho concorrente apaga a pendente que deixou de valer): ignoradas, nunca 404 do lote.
    for (const id of ids) if (!seen.has(id)) skippedDetails.push({ id, reason: "NOT_FOUND" });
    await this.reviews.resolve(applied, "APPLIED", input.userId);
    return { applied, skipped: skippedDetails.map((d) => d.id), skippedDetails };
  }

  private async suggestNow(variantId: string): Promise<{ suggestedCents: number; salePriceCents: number } | null> {
    const source = await this.variants.find(variantId);
    if (!source) return null;
    const settings = await this.settings.getMarginSettings();
    if (!settings.configured || source.averageCost4 <= 0) return null;
    const levels = await this.margins.forVariant(variantId);
    try {
      const suggestedCents = suggestedPriceCents({
        averageCost4: source.averageCost4,
        expensesBps: settings.expensesBps,
        marginBps: resolveTargetMarginBps({ ...levels, store: settings.defaultMarginBps }),
        strategy: settings.roundingStrategy,
      });
      return { suggestedCents, salePriceCents: source.salePriceCents };
    } catch (e) {
      if (!(e instanceof BusinessRuleError)) throw e;
      return null;
    }
  }
}
