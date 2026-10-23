-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "salePrice" DECIMAL(65,30) NOT NULL DEFAULT 0;
-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "sellerId" TEXT;
-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
