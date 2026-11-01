-- Encargos de atraso no recebimento (multa, juros de mora pró-rata e dispensa) e a marca
-- "sem encargos" do documento. Aditivo; funciona em banco vazio e com dados.

-- Pagamento: valor (amount) continua = principal abatido; encargos cobrados neste pagamento e a
-- parte dispensada (quem/por quê). Recebido em caixa = amount + fineAmount + interestAmount - waivedAmount.
ALTER TABLE "Payment"
    ADD COLUMN "fineAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "interestAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "waivedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "waiverReason" VARCHAR(200),
    ADD COLUMN "waivedById" TEXT;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_late_fees_check" CHECK (
    "fineAmount" >= 0 AND "interestAmount" >= 0 AND "waivedAmount" >= 0
    AND "waivedAmount" <= "fineAmount" + "interestAmount"
);
-- Dispensa ⇔ motivo e autor registrados (o autor pode sumir depois: FK SET NULL).
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_waiver_check" CHECK (
    ("waivedAmount" > 0) = ("waiverReason" IS NOT NULL)
    AND ("waivedAmount" > 0 OR "waivedById" IS NULL)
);

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_waivedById_fkey"
    FOREIGN KEY ("waivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Payment_waivedById_idx" ON "Payment"("waivedById");

-- Documento sem multa/juros (vendas anteriores ao crediário, parcelado antigo, caderninho).
ALTER TABLE "FinancialDocument" ADD COLUMN "noLateFees" BOOLEAN NOT NULL DEFAULT false;

-- Tudo o que já existe nasceu antes da cobrança de encargos: só os recebíveis de vendas no
-- crediário (com SaleFinancing) continuam sujeitos a multa e juros.
UPDATE "FinancialDocument" SET "noLateFees" = true
WHERE NOT (
    "type" = 'RECEIVABLE'
    AND "originType" = 'SALE'
    AND "originId" IN (SELECT "saleId" FROM "SaleFinancing")
);
