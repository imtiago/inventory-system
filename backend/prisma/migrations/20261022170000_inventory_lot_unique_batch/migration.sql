-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_productVariantId_batchNumber_key" ON "InventoryLot"("productVariantId", "batchNumber");
