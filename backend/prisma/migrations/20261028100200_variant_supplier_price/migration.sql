-- Preço sugerido pelo fornecedor (revista). Aditivo; linhas existentes ficam NULL.
ALTER TABLE "ProductVariant" ADD COLUMN "supplierSuggestedPrice" DECIMAL(12,2);
ALTER TABLE "ProductVariant" ADD COLUMN "supplierSuggestedPriceUpdatedAt" TIMESTAMP(3);

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_supplierSuggestedPrice_positive" CHECK ("supplierSuggestedPrice" IS NULL OR "supplierSuggestedPrice" > 0);
