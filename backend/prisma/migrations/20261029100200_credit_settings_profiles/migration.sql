-- Crediário: configurações (linha única), perfis de crédito, ficha de crédito no cliente e histórico.
-- Aditivo. Valores iniciais da spec gravados aqui (ON CONFLICT DO NOTHING); o crediário nasce DESLIGADO.
-- Clientes existentes ficam no perfil Novo, limite 300,00 (limite inicial do Novo), situação ACTIVE.

CREATE TYPE "CreditProfileCode" AS ENUM ('NEW', 'REGULAR', 'GOOD', 'EXCELLENT');
CREATE TYPE "CreditStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'SUSPENDED');
CREATE TYPE "CreditChangeSource" AS ENUM ('MANUAL', 'AUTO_REVIEW', 'REQUEST', 'LEGACY_IMPORT');

-- Configurações do crediário: `rules` em centavos/bps (validado por creditRulesSchema na escrita e na leitura).
CREATE TABLE "CreditSettings" (
    "id" TEXT NOT NULL,
    "crediarioEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL,
    "enabledAt" TIMESTAMP(3),
    "enabledById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,

    CONSTRAINT "CreditSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditSettings_singleton_check" CHECK ("id" = 'default')
);

ALTER TABLE "CreditSettings" ADD CONSTRAINT "CreditSettings_enabledById_fkey"
    FOREIGN KEY ("enabledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditSettings" ADD CONSTRAINT "CreditSettings_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "CreditSettings" ("id", "crediarioEnabled", "rules")
VALUES ('default', false, '{"bands":[{"upToCents":15000,"maxInstallments":2},{"upToCents":30000,"maxInstallments":3},{"upToCents":60000,"maxInstallments":5},{"upToCents":100000,"maxInstallments":8},{"upToCents":null,"maxInstallments":10}],"minInstallmentCents":3000,"interestFreeInstallments":2,"monthlyRateBps":399,"defaultDueDay":null,"overdueBlockDays":10,"fineBps":200,"monthlyInterestBps":100,"graceDays":3,"autoApproval":{"profiles":["GOOD","EXCELLENT"],"maxDaysLate":5,"minPaidInstallments":6,"maxIncreaseBps":5000},"review":{"weights":{"paidOnTime":10,"relationshipMonth":2,"relationshipMonthsCap":24,"per100Paid":1,"per100PaidCap":50,"dayLate":-1,"paidLate30":-15,"renegotiation":-20},"promoteAt":{"NEW":40,"REGULAR":80,"GOOD":150},"demoteIfDaysLateOver":30,"suspendIfOverdueOver":60}}'::jsonb)
ON CONFLICT ("id") DO NOTHING;

-- Perfis de crédito.
CREATE TABLE "CreditProfile" (
    "code" "CreditProfileCode" NOT NULL,
    "name" TEXT NOT NULL,
    "initialLimit" DECIMAL(12,2) NOT NULL,
    "minDownPaymentBps" INTEGER NOT NULL,
    "maxInstallments" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CreditProfile_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "CreditProfile_initialLimit_check" CHECK ("initialLimit" >= 0),
    CONSTRAINT "CreditProfile_minDownPaymentBps_check" CHECK ("minDownPaymentBps" BETWEEN 0 AND 10000),
    CONSTRAINT "CreditProfile_maxInstallments_check" CHECK ("maxInstallments" BETWEEN 1 AND 24)
);

INSERT INTO "CreditProfile" ("code", "name", "initialLimit", "minDownPaymentBps", "maxInstallments", "position") VALUES
    ('NEW', 'Novo', 300.00, 3000, 3, 0),
    ('REGULAR', 'Regular', 800.00, 1500, 5, 1),
    ('GOOD', 'Bom', 2000.00, 0, 8, 2),
    ('EXCELLENT', 'Excelente', 5000.00, 0, 10, 3)
ON CONFLICT ("code") DO NOTHING;

-- Ficha de crédito no cliente (default constante: sem reescrita da tabela no PG 16).
ALTER TABLE "Customer"
    ADD COLUMN "creditProfileCode" "CreditProfileCode" NOT NULL DEFAULT 'NEW',
    ADD COLUMN "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 300.00,
    ADD COLUMN "creditStatus" "CreditStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_creditLimit_check" CHECK ("creditLimit" >= 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_creditProfileCode_fkey"
    FOREIGN KEY ("creditProfileCode") REFERENCES "CreditProfile"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Histórico de mudanças da ficha.
CREATE TABLE "CreditLimitChange" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fromProfile" "CreditProfileCode" NOT NULL,
    "toProfile" "CreditProfileCode" NOT NULL,
    "fromLimit" DECIMAL(12,2) NOT NULL,
    "toLimit" DECIMAL(12,2) NOT NULL,
    "fromStatus" "CreditStatus" NOT NULL,
    "toStatus" "CreditStatus" NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "source" "CreditChangeSource" NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLimitChange_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CreditLimitChange" ADD CONSTRAINT "CreditLimitChange_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditLimitChange" ADD CONSTRAINT "CreditLimitChange_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CreditLimitChange_customerId_createdAt_idx" ON "CreditLimitChange"("customerId", "createdAt");
