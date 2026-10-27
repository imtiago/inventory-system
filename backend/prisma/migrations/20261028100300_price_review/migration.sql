-- Preços para revisar: uma pendente por variante (único parcial), histórico das resolvidas. Aditivo.
CREATE TYPE "PriceReviewReason" AS ENUM ('COST_CHANGED', 'SETTINGS_CHANGED', 'MARGIN_CHANGED', 'MARGIN_BELOW_TARGET');
CREATE TYPE "PriceReviewStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

CREATE TABLE "PriceReview" (
    "id" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "reason" "PriceReviewReason" NOT NULL,
    "currentPrice" DECIMAL(12,2) NOT NULL,
    "suggestedPrice" DECIMAL(12,2) NOT NULL,
    "status" "PriceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "PriceReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PriceReview_prices_check" CHECK ("currentPrice" >= 0 AND "suggestedPrice" >= 0)
);

ALTER TABLE "PriceReview" ADD CONSTRAINT "PriceReview_productVariantId_fkey"
    FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceReview" ADD CONSTRAINT "PriceReview_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Uma revisão pendente por variante: os gatilhos gravam com ON CONFLICT neste índice.
CREATE UNIQUE INDEX "PriceReview_pending_variant_key" ON "PriceReview"("productVariantId") WHERE "status" = 'PENDING';
CREATE INDEX "PriceReview_status_createdAt_idx" ON "PriceReview"("status", "createdAt");
CREATE INDEX "PriceReview_productVariantId_idx" ON "PriceReview"("productVariantId");
