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
  /** Já resolvidas, sem sugestão possível agora ou que sumiram (continuam como estavam). */
  skipped: string[];
  /** Os mesmos ids de `skipped`, com o motivo. */
  skippedDetails: { id: string; reason: "NOT_PENDING" | "NO_SUGGESTION" | "NOT_FOUND" }[];
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
