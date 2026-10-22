-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'RELEASE';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "averageCost" DECIMAL(65,30),
ADD COLUMN     "currentQuantity" INTEGER,
ADD COLUMN     "inventoryLotId" TEXT,
ADD COLUMN     "previousQuantity" INTEGER;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
