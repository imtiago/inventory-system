import type { Cost4 } from "@shared/domain/cost4";
import type { PriceReviewReason, PriceReviewStatus } from "@pricing/domain/priceReview";
import type { ReviewScope } from "./PriceReviewTrigger";
import type { TargetMarginLevels } from "./TargetMarginReader";

export interface PriceReviewCandidate {
  variantId: string;
  salePriceCents: number;
  /** 0 sem inventário. */
  averageCost4: Cost4;
  levels: TargetMarginLevels;
}

export interface PendingReviewWrite {
  variantId: string;
  reason: PriceReviewReason;
  currentPriceCents: number;
  suggestedPriceCents: number;
}

export interface PriceReviewRecord {
  id: string;
  productVariantId: string;
  reason: PriceReviewReason;
  status: PriceReviewStatus;
  currentPriceCents: number;
  suggestedPriceCents: number;
  createdAt: Date;
}

export interface PriceReviewListItem extends PriceReviewRecord {
  label: string;
}

export interface PriceReviewRepository {
  /** Variantes do escopo com preço, custo médio e margens por nível, em ordem crescente de id. */
  findCandidates(scope: ReviewScope): Promise<PriceReviewCandidate[]>;
  /** INSERT … ON CONFLICT no único parcial (uma PENDING por variante), em ordem crescente de variante. */
  upsertPending(rows: PendingReviewWrite[]): Promise<void>;
  /** Remove as pendentes que deixaram de valer (preço já no sugerido, sem custo…). */
  deletePending(variantIds: string[]): Promise<void>;
  resolvePendingOfVariant(variantId: string, status: Exclude<PriceReviewStatus, "PENDING">, userId: string): Promise<void>;
  findByIds(ids: string[]): Promise<PriceReviewRecord[]>;
  /** FOR UPDATE ORDER BY productVariantId, id (exige transação). */
  lockByIds(ids: string[]): Promise<PriceReviewRecord[]>;
  resolve(ids: string[], status: Exclude<PriceReviewStatus, "PENDING">, userId: string): Promise<void>;
  list(input: { status: PriceReviewStatus; page: number; limit: number }): Promise<{ items: PriceReviewListItem[]; total: number }>;
  countPending(): Promise<number>;
}
