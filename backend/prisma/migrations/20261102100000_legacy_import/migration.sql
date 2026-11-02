-- Migração do caderninho: origem LEGACY das contas a receber, parcela "a combinar" e lotes de importação. Aditivo.

-- Origem nova. O valor não é usado nesta migration (PostgreSQL não deixa usar o valor
-- recém-adicionado na mesma transação); só passa a valer depois do commit.
ALTER TYPE "FinancialOriginType" ADD VALUE IF NOT EXISTS 'LEGACY';

-- Parcela com vencimento a combinar: nunca conta como vencida (lista, resumo, dashboard, CSV, crediário).
ALTER TABLE "FinancialParcel" ADD COLUMN "dueDateUnknown" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "LegacyImportStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'REVERTED');
CREATE TYPE "LegacyImportSource" AS ENUM ('CSV', 'MANUAL');
CREATE TYPE "LegacyImportRowStatus" AS ENUM ('OK', 'WARNING', 'ERROR', 'IGNORED');

CREATE TABLE "LegacyImportBatch" (
    "id" TEXT NOT NULL,
    "status" "LegacyImportStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "LegacyImportSource" NOT NULL,
    "fileName" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "limitRule" TEXT NOT NULL DEFAULT 'MAX_OF_PROFILE_AND_BALANCE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "revertedById" TEXT,
    "revertedAt" TIMESTAMP(3),

    CONSTRAINT "LegacyImportBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LegacyImportBatch" ADD CONSTRAINT "LegacyImportBatch_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegacyImportBatch" ADD CONSTRAINT "LegacyImportBatch_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegacyImportBatch" ADD CONSTRAINT "LegacyImportBatch_revertedById_fkey"
    FOREIGN KEY ("revertedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "LegacyImportBatch_status_createdAt_idx" ON "LegacyImportBatch"("status", "createdAt");

CREATE TABLE "LegacyImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "status" "LegacyImportRowStatus" NOT NULL,
    "customerAction" JSONB NOT NULL DEFAULT '{"kind":"NEW"}',
    "customerId" TEXT,
    "financialDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyImportRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LegacyImportRow" ADD CONSTRAINT "LegacyImportRow_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "LegacyImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegacyImportRow" ADD CONSTRAINT "LegacyImportRow_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegacyImportRow" ADD CONSTRAINT "LegacyImportRow_financialDocumentId_fkey"
    FOREIGN KEY ("financialDocumentId") REFERENCES "FinancialDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "LegacyImportRow_batchId_line_idx" ON "LegacyImportRow"("batchId", "line");
-- Um documento do caderninho por linha (e cada documento vem de uma linha só).
CREATE UNIQUE INDEX "LegacyImportRow_financialDocumentId_key" ON "LegacyImportRow"("financialDocumentId");
CREATE INDEX "LegacyImportRow_customerId_idx" ON "LegacyImportRow"("customerId");
