-- Custo de aquisição completo: despesas do pedido (rateadas nos itens) e parte extra por unidade no lote.
-- Aditivo; linhas existentes recebem 0 (CHECK >= 0 sempre satisfeito).
ALTER TABLE "InventoryLot" ADD COLUMN "acquisitionExtraCost" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "Purchase" ADD COLUMN "extraCosts" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_acquisitionExtraCost_nonneg" CHECK ("acquisitionExtraCost" >= 0);
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_extraCosts_nonneg" CHECK ("extraCosts" >= 0);
