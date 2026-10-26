-- Onda 9: acabamento do banco. Dados existentes conferidos antes (custos com ate 4 casas
-- significativas; nenhum fluxo da aplicacao apaga documento financeiro).

-- 1) Historico financeiro nao some em cascata: apagar documento/parcela com filhos passa a falhar.
ALTER TABLE "FinancialParcel" DROP CONSTRAINT "FinancialParcel_financialDocumentId_fkey";
ALTER TABLE "FinancialParcel" ADD CONSTRAINT "FinancialParcel_financialDocumentId_fkey"
  FOREIGN KEY ("financialDocumentId") REFERENCES "FinancialDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_parcelId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_parcelId_fkey"
  FOREIGN KEY ("parcelId") REFERENCES "FinancialParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Custos unitarios/medios com escala explicita (14,4).
ALTER TABLE "InventoryLot" ALTER COLUMN "unitCost" TYPE DECIMAL(14,4);
ALTER TABLE "Inventory" ALTER COLUMN "averageCost" TYPE DECIMAL(14,4);
ALTER TABLE "StockMovement" ALTER COLUMN "averageCost" TYPE DECIMAL(14,4);
ALTER TABLE "PurchaseItem" ALTER COLUMN "unitCost" TYPE DECIMAL(14,4);
