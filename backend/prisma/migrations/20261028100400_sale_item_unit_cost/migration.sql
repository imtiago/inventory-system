-- Custo unitário (média da variante no momento da venda). Vendas antigas ficam NULL.
ALTER TABLE "SaleItem" ADD COLUMN "unitCost" DECIMAL(14,4);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_unitCost_check" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);
