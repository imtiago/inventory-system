-- Precificação: configurações (linha única, criada sob demanda), despesas de venda e margem-alvo por nível.
CREATE TYPE "RoundingStrategy" AS ENUM ('STORE_TABLE', 'END_90', 'END_99', 'INTEGER', 'NONE');

CREATE TABLE "PricingSettings" (
    "id" TEXT NOT NULL,
    "defaultMarginBps" INTEGER NOT NULL,
    "roundingStrategy" "RoundingStrategy" NOT NULL DEFAULT 'STORE_TABLE',
    "alertThresholdBps" INTEGER NOT NULL DEFAULT 200,
    "cardFees" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PricingSettings_singleton_check" CHECK ("id" = 'default'),
    CONSTRAINT "PricingSettings_defaultMarginBps_check" CHECK ("defaultMarginBps" >= 0 AND "defaultMarginBps" <= 9999),
    CONSTRAINT "PricingSettings_alertThresholdBps_check" CHECK ("alertThresholdBps" >= 0)
);

ALTER TABLE "PricingSettings" ADD CONSTRAINT "PricingSettings_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PricingExpense" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingExpense_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PricingExpense_percentBps_check" CHECK ("percentBps" >= 0 AND "percentBps" <= 9999)
);

ALTER TABLE "Category" ADD COLUMN "targetMarginBps" INTEGER,
    ADD CONSTRAINT "Category_targetMarginBps_check" CHECK ("targetMarginBps" IS NULL OR ("targetMarginBps" >= 0 AND "targetMarginBps" <= 9999));
ALTER TABLE "Product" ADD COLUMN "targetMarginBps" INTEGER,
    ADD CONSTRAINT "Product_targetMarginBps_check" CHECK ("targetMarginBps" IS NULL OR ("targetMarginBps" >= 0 AND "targetMarginBps" <= 9999));
ALTER TABLE "ProductVariant" ADD COLUMN "targetMarginBps" INTEGER,
    ADD CONSTRAINT "ProductVariant_targetMarginBps_check" CHECK ("targetMarginBps" IS NULL OR ("targetMarginBps" >= 0 AND "targetMarginBps" <= 9999));
