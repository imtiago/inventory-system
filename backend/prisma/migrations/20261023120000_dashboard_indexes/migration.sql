-- CreateIndex
CREATE INDEX "FinancialParcel_financialDocumentId_idx" ON "FinancialParcel"("financialDocumentId");

-- CreateIndex
CREATE INDEX "InventoryLot_expirationDate_idx" ON "InventoryLot"("expirationDate");

-- CreateIndex
CREATE INDEX "Payment_parcelId_idx" ON "Payment"("parcelId");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE INDEX "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

