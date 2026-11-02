-- Condição de pagamento escolhida no fechamento da venda (crediário: Task 8).
-- Vendas existentes ficam como LEGACY_INSTALLMENTS (parcelado antigo, sem crediário).
CREATE TYPE "PaymentCondition" AS ENUM ('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'CREDIARIO', 'LEGACY_INSTALLMENTS');

ALTER TABLE "Sale"
  ADD COLUMN "paymentCondition" "PaymentCondition" NOT NULL DEFAULT 'LEGACY_INSTALLMENTS',
  ADD COLUMN "cardFeePassedOn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cardInstallments" INTEGER,
  ADD COLUMN "cardFeeBps" INTEGER,
  ADD COLUMN "surchargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "downPayment" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_cardInstallments_check" CHECK ("cardInstallments" IS NULL OR "cardInstallments" BETWEEN 1 AND 12),
  ADD CONSTRAINT "Sale_cardFeeBps_check" CHECK ("cardFeeBps" IS NULL OR "cardFeeBps" BETWEEN 0 AND 9999),
  ADD CONSTRAINT "Sale_surchargeAmount_check" CHECK ("surchargeAmount" >= 0),
  ADD CONSTRAINT "Sale_downPayment_check" CHECK ("downPayment" >= 0);

-- Pagamento registrado no próprio fechamento da venda (estornado automaticamente no cancelamento, até 7 dias).
ALTER TABLE "Payment" ADD COLUMN "atCheckout" BOOLEAN NOT NULL DEFAULT false;
