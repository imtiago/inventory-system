-- Índices para consultas de origem, ordenação de histórico e chaves estrangeiras.
CREATE INDEX IF NOT EXISTS "StockMovement_origin_originId_idx" ON "StockMovement"("origin", "originId");
CREATE INDEX IF NOT EXISTS "StockMovement_productVariantId_createdAt_idx" ON "StockMovement"("productVariantId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_inventoryId_createdAt_idx" ON "StockMovement"("inventoryId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
CREATE INDEX IF NOT EXISTS "InventoryLot_inventoryId_remainingQuantity_idx" ON "InventoryLot"("inventoryId", "remainingQuantity");
CREATE INDEX IF NOT EXISTS "FinancialDocument_type_originType_originId_idx" ON "FinancialDocument"("type", "originType", "originId");
CREATE INDEX IF NOT EXISTS "FinancialDocument_type_partyId_idx" ON "FinancialDocument"("type", "partyId");
CREATE INDEX IF NOT EXISTS "FinancialDocument_type_status_idx" ON "FinancialDocument"("type", "status");
CREATE INDEX IF NOT EXISTS "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX IF NOT EXISTS "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
