import { BusinessRuleError } from "@shared/domain/errors";
import type { Cost4 } from "@shared/domain/cost4";
import type { Bps } from "@shared/domain/percent";
import type { RoundingStrategy } from "./priceRounding";
import { realMargin, suggestedPriceCents } from "./pricingMath";

export type PriceReviewReason = "COST_CHANGED" | "SETTINGS_CHANGED" | "MARGIN_CHANGED" | "MARGIN_BELOW_TARGET";
export type PriceReviewStatus = "PENDING" | "APPLIED" | "DISMISSED";

/**
 * Decide se a variante entra (ou continua) na revisão. Sem custo ou sem sugestão possível → null.
 * Margem real abaixo de (alvo − alerta) → MARGIN_BELOW_TARGET (o motivo mais urgente vence);
 * senão sugerido ≠ preço → motivo do gatilho; senão null (nada a revisar).
 */
export function evaluatePriceReview(input: {
  salePriceCents: number;
  averageCost4: Cost4;
  expensesBps: Bps;
  targetMarginBps: Bps;
  alertThresholdBps: Bps;
  strategy: RoundingStrategy;
  triggerReason: Exclude<PriceReviewReason, "MARGIN_BELOW_TARGET">;
}): { reason: PriceReviewReason; suggestedCents: number } | null {
  if (input.averageCost4 <= 0) return null;
  let suggestedCents: number;
  try {
    suggestedCents = suggestedPriceCents({
      averageCost4: input.averageCost4,
      expensesBps: input.expensesBps,
      marginBps: input.targetMarginBps,
      strategy: input.strategy,
    });
  } catch (e) {
    if (e instanceof BusinessRuleError) return null; // despesas + margem ≥ 100%
    throw e;
  }
  const { marginBps } = realMargin({
    priceCents: input.salePriceCents,
    unitCost4: input.averageCost4,
    expensesBps: input.expensesBps,
  });
  if (marginBps < input.targetMarginBps - input.alertThresholdBps) {
    return { reason: "MARGIN_BELOW_TARGET", suggestedCents };
  }
  if (suggestedCents !== input.salePriceCents) return { reason: input.triggerReason, suggestedCents };
  return null;
}
