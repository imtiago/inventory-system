/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Made the column `code` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
