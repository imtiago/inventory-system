-- Fase 6A (pedidos de compra): código PC######, dados de cancelamento, custo
-- unitário do item, dinheiro em DECIMAL(12,2) e purchaseDate como data sem hora.
-- Aditiva: linhas já existentes recebem código e custo antes do NOT NULL/UNIQUE.

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "canceledById" TEXT,
ADD COLUMN     "code" TEXT;

-- Backfill: códigos na ordem de criação, no mesmo formato do gerador (faixa PURCHASE).
UPDATE "Purchase" p
SET "code" = 'PC' || lpad(n.rn::text, 6, '0')
FROM (SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn FROM "Purchase") n
WHERE p.id = n.id;

-- A faixa continua depois dos códigos gerados acima (criada sob demanda se não houver linhas).
INSERT INTO "NumberRange" ("id", "name", "currentValue", "updatedAt")
SELECT gen_random_uuid()::text, 'PURCHASE', count(*), NOW() FROM "Purchase" HAVING count(*) > 0
ON CONFLICT ("name") DO UPDATE
  SET "currentValue" = GREATEST("NumberRange"."currentValue", EXCLUDED."currentValue"),
      "updatedAt" = NOW();

ALTER TABLE "Purchase" ALTER COLUMN "code" SET NOT NULL;

-- Timestamp gravado em UTC → data de negócio (America/Sao_Paulo).
ALTER TABLE "Purchase"
ALTER COLUMN "purchaseDate" SET DATA TYPE DATE
  USING (("purchaseDate" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date,
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "unitCost" DECIMAL(12,2),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "freight" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "tax" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- Backfill: custo unitário = round(total / quantidade), 2 casas (meio para cima).
UPDATE "PurchaseItem"
SET "unitCost" = round("total" / NULLIF("quantity", 0), 2)
WHERE "unitCost" IS NULL;
UPDATE "PurchaseItem" SET "unitCost" = 0 WHERE "unitCost" IS NULL;

ALTER TABLE "PurchaseItem" ALTER COLUMN "unitCost" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_code_key" ON "Purchase"("code");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_canceledById_fkey" FOREIGN KEY ("canceledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
