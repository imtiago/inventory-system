-- Termos de atraso do crediário gravados na venda (snapshot): multa, juros de mora e carência valem
-- como foram contratados; mudar CreditSettings depois só afeta vendas novas. Aditivo.
-- Financiamentos existentes recebem os valores atuais das configurações (os mesmos que já valiam).
ALTER TABLE "SaleFinancing"
    ADD COLUMN "fineBps" INTEGER,
    ADD COLUMN "monthlyInterestBps" INTEGER,
    ADD COLUMN "graceDays" INTEGER;

UPDATE "SaleFinancing" sf
SET "fineBps" = COALESCE((cs.rules->>'fineBps')::int, 200),
    "monthlyInterestBps" = COALESCE((cs.rules->>'monthlyInterestBps')::int, 100),
    "graceDays" = COALESCE((cs.rules->>'graceDays')::int, 3)
FROM (SELECT 1) AS one
LEFT JOIN "CreditSettings" cs ON cs.id = 'default';

ALTER TABLE "SaleFinancing"
    ALTER COLUMN "fineBps" SET NOT NULL,
    ALTER COLUMN "monthlyInterestBps" SET NOT NULL,
    ALTER COLUMN "graceDays" SET NOT NULL,
    ADD CONSTRAINT "SaleFinancing_lateTerms_check" CHECK (
        "fineBps" BETWEEN 0 AND 9999 AND "monthlyInterestBps" BETWEEN 0 AND 9999 AND "graceDays" BETWEEN 0 AND 60
    );

-- Pagamento a receber com data passada (só quem aprova crédito): motivo obrigatório na aplicação.
ALTER TABLE "Payment" ADD COLUMN "backdateReason" VARCHAR(200);
