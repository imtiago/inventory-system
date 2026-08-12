/*
  Warnings:

  - The values [RESERVE] on the enum `StockMovementOrigin` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StockMovementOrigin_new" AS ENUM ('PURCHASE', 'SALE', 'IMPORT', 'MANUAL', 'INVENTORY', 'TRANSFER', 'RETURN');
ALTER TABLE "StockMovement" ALTER COLUMN "origin" TYPE "StockMovementOrigin_new" USING ("origin"::text::"StockMovementOrigin_new");
ALTER TYPE "StockMovementOrigin" RENAME TO "StockMovementOrigin_old";
ALTER TYPE "StockMovementOrigin_new" RENAME TO "StockMovementOrigin";
DROP TYPE "public"."StockMovementOrigin_old";
COMMIT;

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'RESERVE';
