/*
  Warnings:

  - You are about to drop the column `code` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `ProductVariant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Product_code_key";

-- DropIndex
DROP INDEX "ProductVariant_sku_key";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "code";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "sku",
ADD COLUMN     "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_code_key" ON "ProductVariant"("code");
