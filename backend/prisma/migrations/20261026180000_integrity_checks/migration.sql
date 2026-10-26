-- Invariantes de dinheiro e estoque no banco (revisão geral: "Nenhuma restrição CHECK nem
-- unicidade de origem"). Aditiva; dados existentes conferidos antes (nenhuma linha viola).
-- O Prisma não modela CHECK nem índice único parcial.

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_quantity_nonneg_check" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "Inventory_reserved_range_check" CHECK ("reservedQuantity" >= 0 AND "reservedQuantity" <= "quantity");

ALTER TABLE "InventoryLot"
  ADD CONSTRAINT "InventoryLot_remaining_range_check" CHECK ("remainingQuantity" >= 0 AND "remainingQuantity" <= "initialQuantity");

ALTER TABLE "InventoryBoxStock"
  ADD CONSTRAINT "InventoryBoxStock_quantity_positive_check" CHECK ("quantity" > 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive_check" CHECK ("amount" > 0);

ALTER TABLE "FinancialParcel"
  ADD CONSTRAINT "FinancialParcel_amount_positive_check" CHECK ("amount" > 0);

ALTER TABLE "SaleItem"
  ADD CONSTRAINT "SaleItem_quantity_positive_check" CHECK ("quantity" > 0);

ALTER TABLE "PurchaseItem"
  ADD CONSTRAINT "PurchaseItem_quantity_positive_check" CHECK ("quantity" > 0);

-- Um documento ativo por origem de venda/compra (cancelado não conta; NF-e revertida
-- cancela o a pagar antes de reimportar).
CREATE UNIQUE INDEX "FinancialDocument_active_origin_key"
  ON "FinancialDocument" ("type", "originType", "originId")
  WHERE "originType" IN ('SALE', 'PURCHASE') AND "status" <> 'CANCELED';
