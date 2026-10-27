import { fromCents } from "@shared/domain/money";
import type { PriceReviewListItem } from "@pricing/application/contracts/PriceReviewRepository";
import type { PriceReviewReason, PriceReviewStatus } from "@pricing/domain/priceReview";

export interface PriceReviewDTO {
  id: string;
  productVariantId: string;
  label: string;
  currentPrice: number;
  suggestedPrice: number;
  /** sugerido − atual (negativo = baixar o preço). */
  difference: number;
  reason: PriceReviewReason;
  status: PriceReviewStatus;
  createdAt: string;
}

export interface PriceReviewCountDTO {
  pending: number;
}

export interface ApplyPriceReviewsResultDTO {
  /** Revisões aplicadas (preço = sugerido recalculado agora). */
  applied: string[];
  /** Já resolvidas ou sem sugestão possível agora (continuam como estavam). */
  skipped: string[];
}

export function toPriceReviewDTO(r: PriceReviewListItem): PriceReviewDTO {
  return {
    id: r.id,
    productVariantId: r.productVariantId,
    label: r.label,
    currentPrice: fromCents(r.currentPriceCents),
    suggestedPrice: fromCents(r.suggestedPriceCents),
    difference: fromCents(r.suggestedPriceCents - r.currentPriceCents),
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}
