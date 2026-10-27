import { resolveTargetMarginBps } from "@pricing/domain/pricingMath";
import { evaluatePriceReview, type PriceReviewReason } from "@pricing/domain/priceReview";
import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import type { PricingSettingsRepository } from "@pricing/application/contracts/PricingSettingsRepository";
import type { PendingReviewWrite, PriceReviewRepository } from "@pricing/application/contracts/PriceReviewRepository";
import type { PriceReviewTrigger, ReviewScope } from "@pricing/application/contracts/PriceReviewTrigger";

/**
 * Gatilhos da revisão de preços (rodam na transação de quem chama).
 *
 * Travas (sem ciclo):
 * - custo (estoque): inventário/lotes/alocações do caso de uso → trava COMPARTILHADA das configurações →
 *   revisões (ON CONFLICT, variante crescente). Revisões são sempre as últimas.
 * - configuração (settingsChanged): o caso de uso já segura a trava EXCLUSIVA das configurações (lockSettings)
 *   e não trava inventário; recalcula o escopo inteiro em duas instruções (upsert em ordem crescente de
 *   variante, delete das que deixaram de valer). Enquanto ela roda nenhuma entrada de estoque grava revisão
 *   (esperam a trava compartilhada, sem segurar revisões), então não há deadlock com entradas simultâneas, e
 *   quem grava depois lê a configuração nova (READ COMMITTED).
 * - preço aplicado: variante (já travada pelo caso de uso) → revisão da variante.
 */
export class PriceReviewService implements PriceReviewTrigger {
  constructor(
    private readonly reviews: PriceReviewRepository,
    private readonly settings: PricingSettingsReader,
    private readonly settingsLock: Pick<PricingSettingsRepository, "lockSettingsShared">,
  ) {}

  async costChanged(variantId: string): Promise<void> {
    await this.settingsLock.lockSettingsShared();
    await this.evaluate({ kind: "VARIANT", id: variantId }, "COST_CHANGED");
  }

  async settingsChanged(scope: ReviewScope): Promise<void> {
    await this.evaluate(scope, scope.kind === "ALL" ? "SETTINGS_CHANGED" : "MARGIN_CHANGED");
  }

  async priceApplied(variantId: string, userId: string): Promise<void> {
    await this.reviews.resolvePendingOfVariant(variantId, "APPLIED", userId);
  }

  private async evaluate(scope: ReviewScope, triggerReason: Exclude<PriceReviewReason, "MARGIN_BELOW_TARGET">) {
    const s = await this.settings.get();
    if (!s.configured) return;
    const writes: PendingReviewWrite[] = [];
    const clears: string[] = [];
    for (const c of await this.reviews.findCandidates(scope)) {
      const result = evaluatePriceReview({
        salePriceCents: c.salePriceCents,
        averageCost4: c.averageCost4,
        expensesBps: s.expensesBps,
        targetMarginBps: resolveTargetMarginBps({ ...c.levels, store: s.defaultMarginBps }),
        alertThresholdBps: s.alertThresholdBps,
        strategy: s.roundingStrategy,
        triggerReason,
      });
      if (result) {
        writes.push({
          variantId: c.variantId,
          reason: result.reason,
          currentPriceCents: c.salePriceCents,
          suggestedPriceCents: result.suggestedCents,
        });
      } else {
        clears.push(c.variantId);
      }
    }
    await this.reviews.upsertPending(writes);
    await this.reviews.deletePending(clears);
  }
}
