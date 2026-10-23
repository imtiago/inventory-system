-- AlterTable: ordem do item no pedido (aditiva, com backfill antes do NOT NULL).
ALTER TABLE "PurchaseItem" ADD COLUMN "position" INTEGER;

-- Itens existentes: ordem estável por id dentro de cada pedido (0, 1, 2...).
UPDATE "PurchaseItem" AS pi
SET "position" = ordered.rn - 1
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "purchaseId" ORDER BY "id") AS rn
  FROM "PurchaseItem"
) AS ordered
WHERE pi."id" = ordered."id";

ALTER TABLE "PurchaseItem" ALTER COLUMN "position" SET NOT NULL;
