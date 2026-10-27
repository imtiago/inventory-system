-- Plano do crediário gravado na venda (snapshot): preço à vista, entrada, financiado, parcelas,
-- taxa, acréscimo, total a prazo, vencimentos e a autorização de exceção (limite/atraso). Aditivo.
CREATE TABLE "SaleFinancing" (
    "saleId" TEXT NOT NULL,
    "cashPrice" DECIMAL(12,2) NOT NULL,
    "downPayment" DECIMAL(12,2) NOT NULL,
    "downPaymentMethod" "PaymentMethod",
    "financedAmount" DECIMAL(12,2) NOT NULL,
    "installments" INTEGER NOT NULL,
    "monthlyRateBps" INTEGER NOT NULL,
    "surchargeAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "dueDay" INTEGER,
    "firstDueDate" DATE NOT NULL,
    "overrideById" TEXT,
    "overrideReason" VARCHAR(200),
    "overrideKinds" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleFinancing_pkey" PRIMARY KEY ("saleId"),
    CONSTRAINT "SaleFinancing_amounts_check" CHECK (
        "cashPrice" > 0 AND "downPayment" >= 0 AND "financedAmount" > 0
        AND "surchargeAmount" >= 0 AND "totalAmount" > 0
    ),
    CONSTRAINT "SaleFinancing_installments_check" CHECK ("installments" BETWEEN 1 AND 24),
    CONSTRAINT "SaleFinancing_monthlyRateBps_check" CHECK ("monthlyRateBps" BETWEEN 0 AND 9999),
    CONSTRAINT "SaleFinancing_dueDay_check" CHECK ("dueDay" IS NULL OR "dueDay" BETWEEN 1 AND 28),
    CONSTRAINT "SaleFinancing_downPaymentMethod_check" CHECK (("downPayment" > 0) = ("downPaymentMethod" IS NOT NULL)),
    CONSTRAINT "SaleFinancing_overrideKinds_check" CHECK ("overrideKinds" <@ ARRAY['LIMIT', 'OVERDUE']::TEXT[]),
    CONSTRAINT "SaleFinancing_override_check" CHECK (("overrideReason" IS NULL) = (cardinality("overrideKinds") = 0))
);

-- Snapshot 1:1 da venda (venda não é apagada no sistema; a cascata só serve à limpeza de testes).
ALTER TABLE "SaleFinancing" ADD CONSTRAINT "SaleFinancing_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleFinancing" ADD CONSTRAINT "SaleFinancing_overrideById_fkey"
    FOREIGN KEY ("overrideById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SaleFinancing_overrideById_idx" ON "SaleFinancing"("overrideById");
