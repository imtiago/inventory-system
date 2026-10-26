-- Apagar lote faz o banco procurar movimentos por lote (FK ON DELETE SET NULL): sem indice era varredura.
CREATE INDEX "StockMovement_inventoryLotId_idx" ON "StockMovement"("inventoryLotId");
